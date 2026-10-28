import type { RiotClientLocalApi } from "./RiotClientLocalApi.js";

export class ProductLauncherApi {
  private readonly localApi: RiotClientLocalApi;

  constructor(localApi: RiotClientLocalApi) {
    this.localApi = localApi;
  }

  async launch(product = "valorant", patchline = "live"): Promise<void> {
    await this.localApi.post(
      `/product-launcher/v1/products/${encodeURIComponent(product)}/patchlines/${encodeURIComponent(patchline)}`,
    );
  }
}
