import { describe, expect, it } from "vitest";
import {
  normalizeTeamKey,
  resolveTeamName,
  teamSignature,
} from "@/lib/api/football-data-uk/teams";

describe("normalizeTeamKey", () => {
  it("rimuove accenti, punteggiatura e maiuscole", () => {
    expect(normalizeTeamKey("M'Gladbach & Città")).toBe("mgladbach and citta");
  });
});

describe("teamSignature", () => {
  it("rimuove i token societari generici", () => {
    expect(teamSignature("FC Internazionale Milano")).toBe("internazionale milano");
    expect(teamSignature("Brighton and Hove Albion FC")).toBe("brighton hove albion");
  });
});

describe("resolveTeamName", () => {
  it("risolve gli alias espliciti delle fonti esterne", () => {
    expect(resolveTeamName("FC Internazionale Milano")).toBe("Inter");
    expect(resolveTeamName("Manchester City FC")).toBe("Man City");
    expect(resolveTeamName("Manchester United FC")).toBe("Man United");
    expect(resolveTeamName("Paris Saint-Germain FC")).toBe("Paris SG");
    expect(resolveTeamName("Brighton and Hove Albion FC")).toBe("Brighton");
  });

  it("preferisce un nome canonico identico prima del fuzzy matching", () => {
    expect(resolveTeamName("Inter", ["Inter", "Inter Miami"])).toBe("Inter");
    expect(resolveTeamName("Milan", ["Milan", "Monza"])).toBe("Milan");
  });

  it("restituisce il nome ripulito quando non è sicuro", () => {
    expect(resolveTeamName("  Squadra   Sconosciuta  ")).toBe("Squadra Sconosciuta");
    expect(resolveTeamName("Città di Palermo", ["Inter", "Milan"])).toBe("Città di Palermo");
  });
});
