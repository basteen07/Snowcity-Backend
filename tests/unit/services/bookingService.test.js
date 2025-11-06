// Mocks for dependent models used by bookingService.computeTotals
jest.mock('../../../models/attractions.model', () => ({
  getAttractionById: jest.fn(),
}));
jest.mock('../../../models/addons.model', () => ({
  getAddonById: jest.fn(),
}));
jest.mock('../../../models/coupons.model', () => ({
  getCouponByCode: jest.fn(),
  computeDiscount: jest.fn(),
}));

const attractionsModel = require('../../../models/attractions.model');
const addonsModel = require('../../../models/addons.model');
const couponsModel = require('../../../models/coupons.model');

const bookingService = require('../../../services/bookingService');

describe('bookingService.computeTotals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates totals without addons or coupon', async () => {
    attractionsModel.getAttractionById.mockResolvedValue({
      attraction_id: 1,
      title: 'Snow Park',
      base_price: 500,
      discount_percent: 0,
    });

    const result = await bookingService.computeTotals({
      attraction_id: 1,
      addons: [],
      coupon_code: null,
      onDate: '2025-01-01',
    });

    expect(result.total_amount).toBe(500);
    expect(result.discount_amount).toBe(0);
    expect(result.final_amount).toBe(500);
    expect(result.addons).toEqual([]);
    expect(result.attraction.title).toBe('Snow Park');
  });

  it('calculates totals with addons and percent coupon', async () => {
    attractionsModel.getAttractionById.mockResolvedValue({
      attraction_id: 2,
      title: 'Ice Slide',
      base_price: 1000,
      discount_percent: 0,
    });

    // Addon 10: price 100, 10% discount => unit 90, qty 2 => 180
    addonsModel.getAddonById
      .mockResolvedValueOnce({ addon_id: 10, title: 'Jacket', price: 100, discount_percent: 10 })
      // Addon 20: price 50, 0% discount => unit 50, qty 1 => 50
      .mockResolvedValueOnce({ addon_id: 20, title: 'Gloves', price: 50, discount_percent: 0 });

    couponsModel.getCouponByCode.mockResolvedValue({
      coupon_id: 1,
      code: 'SAVE10',
      type: 'percent',
      value: 10,
      min_amount: 0,
      active: true,
    });

    // Total before discount: 1000 + (180 + 50) = 1230
    // 10% of 1230 = 123
    couponsModel.computeDiscount.mockResolvedValue({ discount: 123, reason: 'ok' });

    const result = await bookingService.computeTotals({
      attraction_id: 2,
      addons: [
        { addon_id: 10, quantity: 2 },
        { addon_id: 20, quantity: 1 },
      ],
      coupon_code: 'SAVE10',
      onDate: '2025-01-02',
    });

    expect(result.total_amount).toBe(1230);
    expect(result.discount_amount).toBe(123);
    expect(result.final_amount).toBe(1107);
    expect(result.addons).toEqual([
      { addon_id: 10, quantity: 2, price: 90 },
      { addon_id: 20, quantity: 1, price: 50 },
    ]);
    expect(couponsModel.getCouponByCode).toHaveBeenCalledWith('SAVE10', {
      activeOnly: true,
      onDate: '2025-01-02',
    });
  });
});