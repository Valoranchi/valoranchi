import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileCatalogueStore } from "../src/catalogue/CatalogueStore.js";
import { MemoryCatalogueCache, ValorantApi } from "../src/catalogue/ValorantApi.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import type { HttpGateway } from "../src/riot/HttpGateway.js";

const sampleData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

const versionResponse = { status: 200, data: { riotClientVersion: "release-10.00-1" } };

function gatewayServing(version = versionResponse) {
  return vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith("/version")) return version;
    const endpoint = url.split("/v1/")[1]!.split("?")[0] as keyof ValorantApiCatalogueData;
    if ((endpoint as string) === "competitivetiers") {
      return { status: 200, data: [{ uuid: "set-1", tiers: sampleData.tiers }] };
    }
    if ((endpoint as string) === "levelborders") {
      return {
        status: 200,
        data: sampleData.levelBorders ?? [{ uuid: "border-1", startingLevel: 1 }],
      };
    }
    return { status: 200, data: sampleData[endpoint] };
  });
}

describe("FileCatalogueStore", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riot-client-catalogue-"));
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("round-trips a catalogue per language and returns null for unknown ones", () => {
    const store = new FileCatalogueStore(dir);
    store.write("es-ES", { version: "v1", data: sampleData });

    expect(store.read("es-ES")).toEqual({ version: "v1", data: sampleData });
    expect(store.read("en-US")).toBeNull();
  });

  it("serves the catalogue from disk when the version matches and refetches when it does not", async () => {
    const store = new FileCatalogueStore(dir);
    store.write("en-US", { version: "release-10.00-1", data: sampleData });

    const fresh = gatewayServing();
    const api = new ValorantApi(
      { get: fresh } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    const catalogue = await api.getCatalogue("en-US");
    const first = sampleData.weapons[0]!;
    expect(catalogue.getWeapon(first.uuid)?.displayName).toBe(first.displayName);
    expect(fresh).toHaveBeenCalledTimes(1);

    const newer = gatewayServing({ status: 200, data: { riotClientVersion: "release-10.01-1" } });
    const stale = new ValorantApi(
      { get: newer } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    await stale.getCatalogue("en-US");
    expect(newer).toHaveBeenCalledTimes(18);
    expect(store.read("en-US")?.version).toBe("release-10.01-1");
  });

  it("treats a stored catalogue without bundles as a cache miss", async () => {
    const store = new FileCatalogueStore(dir);
    const { bundles: _, ...dataWithoutBundles } = sampleData;
    store.write("en-US", {
      version: "release-10.00-1",
      data: dataWithoutBundles as unknown as ValorantApiCatalogueData,
    });

    const gateway = gatewayServing();
    const api = new ValorantApi(
      { get: gateway } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    const catalogue = await api.getCatalogue("en-US");

    expect(catalogue.getBundle("bundle-1")?.displayName).toBe("Prime Bundle");
    expect(gateway).toHaveBeenCalledTimes(18);
    expect(store.read("en-US")?.data.bundles).toBeDefined();
  });

  it("treats a stored catalogue without maps as a cache miss", async () => {
    const store = new FileCatalogueStore(dir);
    const { maps: _, ...dataWithoutMaps } = sampleData;
    store.write("en-US", {
      version: "release-10.00-1",
      data: dataWithoutMaps as unknown as ValorantApiCatalogueData,
    });

    const gateway = gatewayServing();
    const api = new ValorantApi(
      { get: gateway } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    const catalogue = await api.getCatalogue("en-US");

    expect(catalogue.getMapByPath("/Game/Maps/Ascent/Ascent")?.displayName).toBe("Ascent");
    expect(gateway).toHaveBeenCalledTimes(18);
    expect(store.read("en-US")?.data.maps).toBeDefined();
  });

  it("treats a stored catalogue without tiers as a cache miss", async () => {
    const store = new FileCatalogueStore(dir);
    const { tiers: _, ...dataWithoutTiers } = sampleData;
    store.write("en-US", {
      version: "release-10.00-1",
      data: dataWithoutTiers as unknown as ValorantApiCatalogueData,
    });

    const gateway = gatewayServing();
    const api = new ValorantApi(
      { get: gateway } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    const catalogue = await api.getCatalogue("en-US");

    expect(catalogue.getTierByNumber(3)?.tierName).toBe("Iron 3");
    expect(gateway).toHaveBeenCalledTimes(18);
    expect(store.read("en-US")?.data.tiers).toBeDefined();
  });

  it("treats a stored catalogue without seasons as a cache miss", async () => {
    const store = new FileCatalogueStore(dir);
    const { seasons: _, ...dataWithoutSeasons } = sampleData;
    store.write("en-US", {
      version: "release-10.00-1",
      data: dataWithoutSeasons as unknown as ValorantApiCatalogueData,
    });

    const gateway = gatewayServing();
    const api = new ValorantApi(
      { get: gateway } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    const catalogue = await api.getCatalogue("en-US");

    expect(catalogue.getSeason("season-act-1")?.displayName).toBe("ACT 1");
    expect(gateway).toHaveBeenCalledTimes(18);
    expect(store.read("en-US")?.data.seasons).toBeDefined();
  });

  it("treats a stored catalogue without contracts as a cache miss", async () => {
    const store = new FileCatalogueStore(dir);
    const { contracts: _, ...dataWithoutContracts } = sampleData;
    store.write("en-US", {
      version: "release-10.00-1",
      data: dataWithoutContracts as unknown as ValorantApiCatalogueData,
    });

    const gateway = gatewayServing();
    const api = new ValorantApi(
      { get: gateway } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    const catalogue = await api.getCatalogue("en-US");

    expect(catalogue.getContract("contract-jett-1")?.displayName).toBe("Jett Gear");
    expect(gateway).toHaveBeenCalledTimes(18);
    expect(store.read("en-US")?.data.contracts).toBeDefined();
  });

  it("treats a stored catalogue without missions as a cache miss", async () => {
    const store = new FileCatalogueStore(dir);
    const { missions: _, ...dataWithoutMissions } = sampleData;
    store.write("en-US", {
      version: "release-10.00-1",
      data: dataWithoutMissions as unknown as ValorantApiCatalogueData,
    });

    const gateway = gatewayServing();
    const api = new ValorantApi(
      { get: gateway } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    const catalogue = await api.getCatalogue("en-US");

    expect(catalogue.getMission("mission-weekly-1")?.title).toBe("Play 10 games");
    expect(gateway).toHaveBeenCalledTimes(18);
    expect(store.read("en-US")?.data.missions).toBeDefined();
  });

  it("treats a stored catalogue without flex or themes as a cache miss", async () => {
    const store = new FileCatalogueStore(dir);
    const { flex: _, themes: __, ...dataWithoutFlex } = sampleData;
    store.write("en-US", {
      version: "release-10.00-1",
      data: dataWithoutFlex as unknown as ValorantApiCatalogueData,
    });

    const gateway = gatewayServing();
    const api = new ValorantApi(
      { get: gateway } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    await api.getCatalogue("en-US");

    expect(gateway).toHaveBeenCalledTimes(18);
    expect(store.read("en-US")?.data.flex).toBeDefined();
  });

  it("refreshCatalogue rewrites the store with the version it fetched", async () => {
    const store = new FileCatalogueStore(dir);
    store.write("en-US", { version: "release-10.00-1", data: sampleData });

    const gateway = gatewayServing({ status: 200, data: { riotClientVersion: "release-10.02-1" } });
    const api = new ValorantApi(
      { get: gateway } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    await api.refreshCatalogue("en-US");

    expect(gateway).toHaveBeenCalledTimes(18);
    expect(store.read("en-US")?.version).toBe("release-10.02-1");

    await api.getCatalogue("en-US");
    expect(gateway).toHaveBeenCalledTimes(18);
  });
});
