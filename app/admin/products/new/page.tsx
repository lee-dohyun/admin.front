import ProductForm from "../ProductForm";

export default function NewProductPage() {
  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">상품 추가</h1>
      <ProductForm />
    </main>
  );
}
