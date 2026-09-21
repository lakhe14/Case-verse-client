import api from './client';

const get = (url, params) => api.get(url, { params }).then((r) => r.data);
const post = (url, body, config) => api.post(url, body, config).then((r) => r.data);
const put = (url, body) => api.put(url, body).then((r) => r.data);
const del = (url) => api.delete(url).then((r) => r.data);

export const auth = {
  register: (body) => post('/auth/register', body),
  login: (body) => post('/auth/login', body),
  staffLogin: (body) => post('/staff/login', body),
  refresh: (refreshToken) => post('/auth/refresh', { refreshToken }),
  me: () => get('/auth/me'),
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  resetPassword: (body) => post('/auth/reset-password', body),
};

export const catalog = {
  categories: () => get('/categories'),
  categoryAttributes: (id) => get(`/categories/${id}/attributes`),
  attributes: () => get('/attributes'),
  products: (params) => get('/products', params),
  bestsellers: (params) => get('/products/bestsellers', params),
  product: (slug) => get(`/products/${slug}`),
};

export const addresses = {
  list: () => get('/addresses'),
  create: (body) => post('/addresses', body),
  update: (id, body) => put(`/addresses/${id}`, body),
  remove: (id) => del(`/addresses/${id}`),
  setDefault: (id) => post(`/addresses/${id}/default`),
};

export const cart = {
  get: () => get('/cart'),
  addItem: (body) => post('/cart/items', body),
  updateItem: (id, quantity) => put(`/cart/items/${id}`, { quantity }),
  removeItem: (id) => del(`/cart/items/${id}`),
  clear: () => del('/cart'),
};

export const coupons = {
  validate: (code, subtotal) => post('/coupons/validate', { code, subtotal }),
};

export const orders = {
  preview: (body) => post('/orders/preview', body),
  place: (body) => post('/orders', body),
  listMine: (params) => get('/orders', params),
  getMine: (id) => get(`/orders/${id}`),
  uploadPaymentProof: (id, formData) => post(`/orders/${id}/payment-proof`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  requestCod: (id) => post(`/orders/${id}/payment-method/cod`),
};

export const reviews = {
  all: (params) => get('/reviews', params),
  forProduct: (productId, params) => get(`/reviews/product/${productId}`, params),
  eligibility: (productId) => get(`/reviews/product/${productId}/eligibility`),
  create: (body) => post('/reviews', body),
  mine: (params) => get('/reviews/mine', params),
};

export const wishlist = {
  list: () => get('/wishlist'),
  add: (productId) => post('/wishlist', { product_id: productId }),
  remove: (productId) => del(`/wishlist/${productId}`),
};

export const loyalty = {
  balance: () => get('/loyalty/balance'),
  transactions: (params) => get('/loyalty/transactions', params),
};

export const admin = {
  // catalog
  products: (params) => get('/admin/products', params),
  product: (id) => get(`/admin/products/${id}`),
  createProduct: (body) => post('/admin/products', body),
  updateProduct: (id, body) => put(`/admin/products/${id}`, body),
  deleteProduct: (id) => del(`/admin/products/${id}`),
  // attributes + taxonomy
  attributes: () => get('/attributes'),
  createAttribute: (body) => post('/admin/attributes', body),
  renameAttribute: (id, body) => put(`/admin/attributes/${id}`, body),
  deleteAttribute: (id) => del(`/admin/attributes/${id}`),
  categoriesWithAttributes: () => get('/admin/categories'),
  createCategory: (body) => post('/admin/categories', body),
  setCategoryAttributes: (id, attribute_ids) =>
    put(`/admin/categories/${id}/attributes`, { attribute_ids }),
  createVariant: (productId, body) => post(`/admin/products/${productId}/variants`, body),
  updateVariant: (productId, variantId, body) =>
    put(`/admin/products/${productId}/variants/${variantId}`, body),
  deleteVariant: (productId, variantId) =>
    del(`/admin/products/${productId}/variants/${variantId}`),
  uploadImages: (productId, formData) =>
    post(`/admin/products/${productId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteImage: (productId, imageId) => del(`/admin/products/${productId}/images/${imageId}`),
  // orders
  orders: (params) => get('/admin/orders', params),
  order: (id) => get(`/admin/orders/${id}`),
  updateOrderStatus: (id, body) => put(`/admin/orders/${id}/status`, body),
  paymentConfirmations: (params) => get('/admin/payment-confirmations', params),
  approvePayment: (id, note) => post(`/admin/payment-confirmations/${id}/approve`, { note }),
  rejectPayment: (id, note) => post(`/admin/payment-confirmations/${id}/reject`, { note }),
  paymentProof: (id) => api.get(`/admin/payment-confirmations/${id}/proof`, { responseType: 'blob' }),
  // reviews
  reviews: (params) => get('/admin/reviews', params),
  moderateReview: (id, status) => put(`/admin/reviews/${id}`, { status }),
  // coupons
  coupons: (params) => get('/admin/coupons', params),
  createCoupon: (body) => post('/admin/coupons', body),
  updateCoupon: (id, body) => put(`/admin/coupons/${id}`, body),
  deleteCoupon: (id) => del(`/admin/coupons/${id}`),
  // analytics + customers
  dashboard: (params) => get('/admin/analytics/dashboard', params),
  overview: () => get('/admin/analytics/overview'),
  sales: (params) => get('/admin/analytics/sales', params),
  topProducts: (params) => get('/admin/analytics/top-products', params),
  customers: (params) => get('/admin/customers', params),
  customer: (id) => get(`/admin/customers/${id}`),
  // staff + roles
  staff: () => get('/admin/staff'),
  createStaff: (body) => post('/admin/staff', body),
  updateStaff: (id, body) => put(`/admin/staff/${id}`, body),
  deleteStaff: (id) => del(`/admin/staff/${id}`),
  roles: () => get('/admin/roles'),
  createRole: (body) => post('/admin/roles', body),
  setRolePermissions: (id, permissionKeys) =>
    put(`/admin/roles/${id}/permissions`, { permissionKeys }),
  permissions: () => get('/admin/permissions'),
  // settings
  getShipping: () => get('/admin/settings/shipping'),
  putShipping: (rates) => put('/admin/settings/shipping', { rates }),
  getGeneral: () => get('/admin/settings/general'),
  putGeneral: (body) => put('/admin/settings/general', body),
};
