# product.front

`product.api`가 제공하는 상품 정보를 보여주는 Next.js(App Router) 프론트엔드. `customer.front`와 동일하게 자체 API 라우트 없이, 같은 오리진의 `/api/products`, `/api/products/{id}`를 클라이언트에서 직접 fetch한다 — 게이트웨이가 해당 경로를 `product.api`로 프록시하는 것을 전제로 한다.

## 페이지

- `/` — 상품 목록
- `/products/[id]` — 상품 상세

## 실행

```bash
npm install
npm run dev
```
