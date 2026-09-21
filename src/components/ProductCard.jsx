import { Link } from 'react-router-dom';
import { useState } from 'react';
import { wishlist as wishlistApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { motion, useReducedMotion } from 'motion/react';
import { reveal, motionTokens } from '../motion/motionConfig';
import SalePrice from './SalePrice';

function HeartIcon({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path
        d="M12 20.3 4.7 13a4.6 4.6 0 0 1 6.5-6.5l.8.8.8-.8A4.6 4.6 0 0 1 19.3 13Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ProductCard({ product, onWishlistChange }) {
  const { isCustomer } = useAuth();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const img = product.images?.[0]?.url;
  const reduce = useReducedMotion();

  const toggleSave = async () => {
    if (!isCustomer || busy) return;
    setBusy(true);
    try {
      if (saved) {
        await wishlistApi.remove(product.id);
        setSaved(false);
        toast.success(`Removed ${product.name} from your wishlist.`);
      } else {
        await wishlistApi.add(product.id);
        setSaved(true);
        toast.success(`Saved ${product.name} to your wishlist.`);
      }
      onWishlistChange?.();
    } catch (err) {
      toast.error(err.message || 'Could not update your wishlist.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.article className="product-card" variants={reveal} layout="position" whileHover={reduce ? undefined : { y: -4 }} transition={motionTokens.spring.soft}>
      <Link to={`/p/${product.slug}`} className="pc-link">
        <div className="pc-media">
          {img ? (
            <motion.img src={img} alt={product.name} loading="lazy" whileHover={reduce ? undefined : { scale: 1.035 }} transition={{ duration: motionTokens.duration.normal, ease: motionTokens.ease.standard }} />
          ) : (
            <span className="pc-empty">{product.name}</span>
          )}
        </div>
        <div className="pc-body">
          <div className="pc-name">{product.name}</div>
          <div className="pc-cat">{product.category?.name}</div>
          <div className="pc-price">
            <SalePrice price={product.price_from} compareAt={product.compare_at_price_from} compact />
          </div>
          {!product.in_stock && <div className="pc-oos">Out of stock</div>}
        </div>
      </Link>
      {isCustomer && (
        <motion.button
          type="button"
          className="pc-save"
          onClick={toggleSave}
          disabled={busy}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          whileTap={reduce ? undefined : { scale: 0.88 }}
        >
          <HeartIcon filled={saved} />
        </motion.button>
      )}
    </motion.article>
  );
}
