import { ValidationError } from "../errors.js";
import type { WishlistHit } from "../model/index.js";

export class WebhookNotifier {
  private readonly url: URL;

  constructor(urlString: string) {
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      throw new ValidationError("invalid-webhook", "Invalid webhook URL");
    }

    if (parsed.protocol !== "https:") {
      throw new ValidationError("invalid-webhook", "Webhook URL must use https");
    }

    this.url = parsed;
  }

  get isDiscord(): boolean {
    return (
      (this.url.hostname === "discord.com" || this.url.hostname === "discordapp.com") &&
      this.url.pathname.startsWith("/api/webhooks/")
    );
  }

  async notify<T = unknown>(
    item: T,
    discordBuilder?: (item: T) => unknown,
  ): Promise<void> {
    let payload: string;

    if (this.isDiscord) {
      if (discordBuilder) {
        const built = discordBuilder(item);
        payload = typeof built === "string" ? built : JSON.stringify(built);
      } else if (this.isWishlistHit(item)) {
        payload = this.buildDiscordPayload(item);
      } else {
        payload = JSON.stringify(item);
      }
    } else {
      payload = JSON.stringify(item);
    }

    const response = await fetch(this.url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed with status ${response.status}`);
    }
  }

  private isWishlistHit(item: unknown): item is WishlistHit {
    return Boolean(
      item &&
        typeof item === "object" &&
        "where" in item &&
        "skin" in item &&
        "price" in item,
    );
  }

  private buildDiscordPayload(hit: WishlistHit): string {
    const whereText =
      hit.where === "daily"
        ? "daily store"
        : hit.where === "night-market"
          ? "night market"
          : "bundle";
    const price = hit.discountedPrice ?? hit.price;
    const content = `${hit.skin.name} is in your ${whereText} for ${price} VP`;
    return JSON.stringify({ content });
  }
}
