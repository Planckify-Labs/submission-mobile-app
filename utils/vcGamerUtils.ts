export interface TVCGamerPLNVoucher {
  tokenCode: string;
  name: string;
  tarifOrPower: string;
  kwhCapacity: string;
}

// PLN voucher format (slash-delimited, order may vary):
//   2174-8986-6628-2450-0152/NURMULIANI-MTMN/R1/450VA/43.9KWH
//
// Each segment is identified by its pattern:
//   Token code  — five groups of 4 digits joined by dashes
//   kWh         — digits (decimal ok) followed by KWH
//   VA / power  — digits followed by VA
//   Tarif       — R + digits (e.g. R1, R2)
//   Name        — anything else
const PLN_TOKEN_CODE = /^\d{4}-\d{4}-\d{4}-\d{4}-\d{4}$/;
const PLN_KWH = /^([\d.]+)\s*KWH$/i;
const PLN_VA = /^\d+\s*VA$/i;
const PLN_TARIF = /^R\d+$/i;

const extractPLNVoucher = (voucherCode: string): TVCGamerPLNVoucher => {
  const parts = voucherCode.split("/");

  let tokenCode = "";
  let name = "";
  let tarif = "";
  let power = "";
  let kwhCapacity = "";

  for (const part of parts) {
    if (PLN_TOKEN_CODE.test(part)) {
      tokenCode = part;
    } else if (PLN_KWH.test(part)) {
      const match = part.match(PLN_KWH);
      kwhCapacity = match ? `${match[1]}KWH` : part;
    } else if (PLN_VA.test(part)) {
      power = part;
    } else if (PLN_TARIF.test(part)) {
      tarif = part;
    } else {
      name = part;
    }
  }

  return {
    tokenCode,
    name,
    tarifOrPower: tarif && power ? `${tarif}/${power}` : tarif || power,
    kwhCapacity,
  };
};

type TVoucherType = "PLN";

export const extractVoucher = (
  voucherType: TVoucherType,
  voucherCode: string,
) => {
  switch (voucherType) {
    case "PLN":
      return extractPLNVoucher(voucherCode);

    default:
      break;
  }
};
