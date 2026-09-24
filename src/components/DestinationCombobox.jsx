import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { geo } from '../api/endpoints';
import { filterDestinations } from '../utils/placeText';

const SEARCH_DELAY_MS = 220;
const DISTRICT_LIST_LIMIT = 40;

const destinationLabel = (destination) => destination?.label || destination?.name || '';

function placeLine(result) {
  return [result.municipality, result.district, result.province].filter(Boolean).filter((part, index, parts) => parts.indexOf(part) === index).join(', ');
}

/** What selecting a search result tells the customer about the courier destination. */
function suggestionText(result) {
  const suggestion = result.suggested_destination;
  if (result.kind === 'destination') return 'ParcelMoover delivery destination';
  if (suggestion) {
    return suggestion.match === 'nearby'
      ? `Nearest delivery destination: ${suggestion.label}`
      : `Suggested delivery destination: ${suggestion.label}`;
  }
  if (result.district && result.district_destination_count) return `Choose a delivery destination in ${result.district}`;
  return 'Choose a delivery destination manually';
}

/**
 * Searchable ParcelMoover destination picker (WAI-ARIA combobox + listbox).
 *
 * Typing searches places customers know (neighbourhoods, towns, municipalities,
 * districts) through the server's offline index, and ParcelMoover destinations
 * themselves. A place is never treated as a destination: choosing one selects
 * its suggested real destination, or narrows the list to its district so the
 * customer picks one. The value passed to onChange is always a destination id
 * from the loaded ParcelMoover list; the server prices it.
 */
export default function DestinationCombobox({ destinations, value, onChange, loadError, label = 'ParcelMoover delivery destination', context: outsideContext }) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const noteId = `${baseId}-note`;
  const inputRef = useRef(null);
  const selected = useMemo(() => destinations.find((destination) => destination.id === value) || null, [destinations, value]);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [serverResults, setServerResults] = useState(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [districtFilter, setDistrictFilter] = useState(null);
  const [context, setContext] = useState(null);

  // A place picked elsewhere (e.g. "Use my location") explains the selection here too.
  useEffect(() => { if (outsideContext) { setContext(outsideContext); setDistrictFilter(outsideContext.district && !outsideContext.destination ? outsideContext.district : null); } }, [outsideContext]);

  // Server search, debounced; an older response never replaces a newer one.
  useEffect(() => {
    const text = query.trim();
    if (!editing || text.length < 2) { setServerResults(null); setSearching(false); return undefined; }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      geo.searchLocalities(text, { signal: controller.signal })
        .then((response) => { setServerResults(response.data || []); setSearchFailed(false); setSearching(false); })
        .catch((error) => {
          if (controller.signal.aborted || error?.code === 'ERR_CANCELED') return;
          setServerResults(null); setSearchFailed(true); setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, editing]);

  const options = useMemo(() => {
    const text = query.trim();
    if (text.length >= 2) {
      if (serverResults) return serverResults.map((result, index) => ({ key: `r${index}`, result }));
      // Until the server answers (or if it cannot), match destination names locally.
      return filterDestinations(destinations, text).map((destination) => ({ key: `d${destination.id}`, result: { kind: 'destination', name: destinationLabel(destination), district: destination.district, suggested_destination: { id: destination.id, label: destinationLabel(destination), match: 'destination' } } }));
    }
    if (districtFilter) {
      return destinations
        .filter((destination) => destination.district === districtFilter)
        .slice(0, DISTRICT_LIST_LIMIT)
        .map((destination) => ({ key: `d${destination.id}`, result: { kind: 'destination', name: destinationLabel(destination), district: destination.district, suggested_destination: { id: destination.id, label: destinationLabel(destination), match: 'destination' } } }));
    }
    return [];
  }, [query, serverResults, destinations, districtFilter]);

  useEffect(() => { setActive(options.length ? 0 : -1); }, [options]);

  const displayValue = editing ? query : destinationLabel(selected);

  const startEditing = () => {
    if (editing) return;
    setEditing(true);
    setQuery('');
    setOpen(true);
    // Small screens: bring the field to the top so the list is not under the keyboard.
    if (window.matchMedia?.('(max-width: 640px)').matches) {
      setTimeout(() => inputRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);
    }
  };

  const finish = () => {
    setEditing(false);
    setOpen(false);
    setQuery('');
    setServerResults(null);
  };

  const choose = (option) => {
    const { result } = option;
    const suggestion = result.suggested_destination;
    const destination = suggestion && destinations.find((item) => item.id === suggestion.id);
    if (result.kind === 'destination' && destination) {
      onChange(destination.id, destination);
      setContext(null);
      setDistrictFilter(null);
      finish();
      return;
    }
    if (destination) {
      onChange(destination.id, destination);
      setContext({ place: result.name, municipality: result.municipality, district: result.district, destination: destinationLabel(destination), match: suggestion.match });
      setDistrictFilter(null);
      finish();
      return;
    }
    // No confident mapping: keep the place, clear any old destination and list the district's destinations.
    onChange('', null);
    setContext({ place: result.kind === 'district' ? null : result.name, municipality: result.municipality, district: result.district, destination: null, match: null });
    setDistrictFilter(result.district_destination_count ? result.district : null);
    setQuery('');
    setServerResults(null);
    setOpen(Boolean(result.district_destination_count));
    inputRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) { startEditing(); setOpen(true); return; }
      setActive((index) => (options.length ? (index + 1) % options.length : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (options.length ? (index - 1 + options.length) % options.length : -1));
    } else if (event.key === 'Enter') {
      if (open && active >= 0 && options[active]) {
        event.preventDefault();
        choose(options[active]);
      } else if (editing) {
        event.preventDefault();
      }
    } else if (event.key === 'Escape') {
      if (editing) { event.preventDefault(); finish(); }
    }
  };

  const status = (() => {
    const text = query.trim();
    if (!editing) return '';
    if (text.length < 2) return districtFilter ? `Delivery destinations in ${districtFilter}` : 'Type a town, area, municipality or district';
    if (searching && !options.length) return 'Searching…';
    if (!options.length) return 'No matching places. Try the municipality or district name.';
    return `${options.length} result${options.length === 1 ? '' : 's'}`;
  })();

  const activeId = open && active >= 0 && options[active] ? `${listId}-${active}` : undefined;
  const contextNote = context && (context.place || context.district) ? (
    <p className="destination-context small" id={noteId} data-testid="destination-context">
      {context.place ? <><strong>{context.place}</strong>{[context.municipality, context.district].filter(Boolean).length ? `, ${[context.municipality, context.district].filter(Boolean).join(', ')}` : ''}. </> : null}
      {context.destination
        ? (context.match === 'nearby'
          ? <>Nearest delivery destination: <strong>{context.destination}</strong>. Please check it suits you.</>
          : <>Suggested delivery destination: <strong>{context.destination}</strong>.</>)
        : <>No ParcelMoover destination matches this place. Choose the nearest one{context.district ? ` in ${context.district}` : ''}.</>}
    </p>
  ) : null;

  return (
    <div className="field destination-combobox">
      <label className="field-label" htmlFor={inputId}>{label}</label>
      <div className="destination-combobox__control">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-describedby={contextNote ? noteId : undefined}
          aria-required="true"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={destinations.length ? 'Search your area, town or district' : 'Loading delivery destinations…'}
          disabled={!destinations.length}
          value={displayValue}
          data-value={value || ''}
          onFocus={startEditing}
          onClick={() => { if (!open) { startEditing(); setOpen(true); } }}
          onChange={(event) => { setEditing(true); setQuery(event.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => { if (document.activeElement !== inputRef.current) finish(); }, 120)}
        />
        {selected && !editing && (
          <button type="button" className="destination-combobox__change" onClick={() => inputRef.current?.focus()}>Change</button>
        )}
      </div>
      <div className="destination-combobox__status muted small" role="status" aria-live="polite">{open ? status : ''}</div>
      <ul id={listId} role="listbox" aria-label="Delivery destination suggestions" className="destination-combobox__list" hidden={!open || !options.length}>
        {options.map((option, index) => {
          const { result } = option;
          const secondary = result.kind === 'destination' ? null : placeLine(result);
          return (
            <li
              key={option.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={`destination-combobox__option${index === active ? ' is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
            >
              <span className="destination-combobox__primary">{result.name}</span>
              {secondary && <span className="destination-combobox__secondary">{secondary}</span>}
              <span className={`destination-combobox__hint${result.kind === 'destination' || result.suggested_destination ? ' is-destination' : ''}`}>{suggestionText(result)}</span>
            </li>
          );
        })}
      </ul>
      {open && searchFailed && query.trim().length >= 2 && <span className="muted small">Place search is unavailable right now; showing matching delivery destinations only.</span>}
      {contextNote}
      {loadError && <span className="field-error">Delivery destinations are temporarily unavailable. Please try again.</span>}
      {open && serverResults && serverResults.some((result) => result.kind !== 'destination') && (
        <span className="destination-combobox__credit muted small">Place names © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></span>
      )}
    </div>
  );
}
