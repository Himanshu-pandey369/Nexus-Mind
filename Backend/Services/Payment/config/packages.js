/**
 * Trusted credit packages — the ONLY source of truth for pricing.
 * Frontend must send a packageId; backend looks up actual price and credits here.
 * Amounts are in INR (paise conversion happens at order creation).
 */
const CREDIT_PACKAGES = [
  {
    id: "starter",
    name: "Starter",
    price: 449,        // ₹449
    currency: "INR",
    credits: 1000,
    bonusCredits: 0,
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 1699,       // ₹1699
    currency: "INR",
    credits: 5000,
    bonusCredits: 500,
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 3999,       // ₹3999
    currency: "INR",
    credits: 15000,
    bonusCredits: 2000,
    popular: false,
  },
];

export function getPackageById(packageId) {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === packageId) || null;
}

export function getAllPackages() {
  return CREDIT_PACKAGES.map(({ id, name, price, currency, credits, bonusCredits, popular }) => ({
    id,
    name,
    price,
    currency,
    credits,
    bonusCredits,
    popular,
  }));
}

export default CREDIT_PACKAGES;
