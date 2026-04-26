import type { TPurchaseResponse } from "@/api/types/purchase";
import type { TRedemptionDetail } from "@/api/types/redeem";
import type {
  TPaymentTransactionDetail,
  TTransaction,
} from "@/api/types/transaction";
import MerchantPaymentDetailCard from "./render-activity-detail-cards/MerchantPaymentDetailCard";
import PurchasedProductDetailCard from "./render-activity-detail-cards/PurchasedProductDetailCard";
import TransferDetailCard from "./render-activity-detail-cards/TransferDetailCard";

export default function RenderActivityDetailCards({
  purchase,
  transfer,
  payment,
  redemption,
}: {
  purchase?: TPurchaseResponse;
  transfer?: TTransaction;
  payment?: TPaymentTransactionDetail;
  redemption?: TRedemptionDetail;
}) {
  return (
    <>
      {purchase && <PurchasedProductDetailCard purchase={purchase} />}
      {redemption && <PurchasedProductDetailCard redemption={redemption} />}
      {payment && <MerchantPaymentDetailCard payment={payment} />}
      {transfer && <TransferDetailCard transfer={transfer} />}
    </>
  );
}
