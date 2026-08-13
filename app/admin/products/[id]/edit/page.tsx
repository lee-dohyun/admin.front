import ProductForm from "../../ProductForm";
import VariantManager from "../../VariantManager";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">상품 수정</h1>
      <ProductForm productId={Number(id)} />
      <VariantManager productId={Number(id)} />
    </main>
  );
}
