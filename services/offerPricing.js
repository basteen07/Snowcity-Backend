const offersModel = require('../models/offers.model');

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

async function applyOfferPricing({
  targetType,
  targetId,
  slotType = null,
  slotId = null,
  baseAmount = 0,
  booking_date = null,
  booking_time = null,
} = {}) {
  const base = toNumber(baseAmount, 0);
  const normalizedTargetId = targetId == null ? null : Number(targetId);
  const normalizedSlotId = slotId == null ? null : Number(slotId);
  if (!offersModel?.findApplicableOfferRule || !targetType || !targetId || base <= 0) {
    return { unit: base, discount: 0, discount_percent: 0, offer: null };
  }

  const match = await offersModel.findApplicableOfferRule({
    targetType,
    targetId: normalizedTargetId,
    slotType,
    slotId: normalizedSlotId,
    date: booking_date,
    time: booking_time,
  });

  if (!match) {
    return { unit: base, discount: 0, discount_percent: 0, offer: null };
  }

  const { offer, rule } = match;
  let discountType = rule?.rule_discount_type || offer.discount_type || (offer.discount_percent ? 'percent' : null);
  let discountValue = rule?.rule_discount_value ?? offer.discount_value ?? offer.discount_percent ?? 0;

  if (!discountType || !discountValue) {
    return { unit: base, discount: 0, discount_percent: 0, offer: null };
  }

  discountType = String(discountType).toLowerCase();
  let discount = discountType === 'amount'
    ? toNumber(discountValue, 0)
    : (toNumber(discountValue, 0) / 100) * base;

  if (offer.max_discount != null) {
    discount = Math.min(discount, Number(offer.max_discount));
  }
  discount = Math.min(discount, base);

  const finalUnit = toNumber(base - discount, 0);
  const discount_percent = base > 0 ? (discount / base) * 100 : 0;

  return {
    unit: finalUnit,
    discount,
    discount_percent,
    offer: {
      offer_id: offer.offer_id,
      rule_id: rule.rule_id,
      title: offer.title,
      discount_type: discountType,
      discount_value: toNumber(discountValue, 0),
      max_discount: offer.max_discount != null ? Number(offer.max_discount) : null,
    },
  };
}

module.exports = {
  applyOfferPricing,
};
