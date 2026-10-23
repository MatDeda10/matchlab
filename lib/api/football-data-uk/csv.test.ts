import { describe, expect, it } from "vitest";
import {
  localKickoffToUtc,
  parseCsv,
  parseDate,
  seasonCode,
  seasonLabel,
  slugify,
  startYearFor,
  toObjects,
} from "@/lib/api/football-data-uk/csv";

describe("parseCsv", () => {
  it("rimuove il BOM e gestisce CRLF, virgole e virgolette", () => {
    const rows = parseCsv(
      '\uFEFFDate,Home,Away,Note\r\n23/10/2026,"Inter, FC",Milan,"Ha detto ""ok"""\r\n',
    );
    expect(rows).toEqual([
      ["Date", "Home", "Away", "Note"],
      ["23/10/2026", "Inter, FC", "Milan", 'Ha detto "ok"'],
    ]);
  });

  it("ignora righe vuote e mantiene celle vuote", () => {
    expect(parseCsv("A,B\n,\n1,\n\n")).toEqual([
      ["A", "B"],
      ["1", ""],
    ]);
  });

  it("converte le righe in oggetti con header ripulito", () => {
    const objects = toObjects([
      [" Date ", "Home", ""],
      ["23/10/2026", " Inter ", "ignorato"],
    ]);
    expect(objects).toEqual([{ Date: "23/10/2026", Home: "Inter" }]);
  });
});

describe("parseDate", () => {
  it("accetta date con anno a 2 o 4 cifre", () => {
    expect(parseDate("23/10/2026")).toEqual({
      year: 2026,
      month: 10,
      day: 23,
      dateKey: "2026-10-23",
    });
    expect(parseDate("1-9-26")?.dateKey).toBe("2026-09-01");
    expect(parseDate("1-9-99")?.dateKey).toBe("1999-09-01");
  });

  it("rifiuta valori non validi", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("2026-10-23")).toBeNull();
    expect(parseDate("32/01/2026")).toBeNull();
    expect(parseDate("01/13/2026")).toBeNull();
  });
});

describe("localKickoffToUtc", () => {
  it("converte l'ora locale di Roma in UTC, estate e inverno", () => {
    const summer = parseDate("23/10/2026");
    const winter = parseDate("10/01/2027");
    expect(summer).not.toBeNull();
    expect(winter).not.toBeNull();
    expect(localKickoffToUtc(summer!, "20:45", "Europe/Rome")).toBe(
      "2026-10-23T18:45:00.000Z",
    );
    expect(localKickoffToUtc(winter!, "18:00", "Europe/Rome")).toBe(
      "2027-01-10T17:00:00.000Z",
    );
  });

  it("usa mezzogiorno locale quando l'orario manca", () => {
    const date = parseDate("23/10/2026")!;
    expect(localKickoffToUtc(date, undefined, "Europe/Rome")).toBe(
      "2026-10-23T10:00:00.000Z",
    );
  });
});

describe("stagioni e slug", () => {
  it("calcola stagione e codice", () => {
    expect(startYearFor(parseDate("01/09/2026")!)).toBe(2026);
    expect(startYearFor(parseDate("01/03/2027")!)).toBe(2026);
    expect(seasonCode(2026)).toBe("2627");
    expect(seasonLabel(2026)).toBe("2026/27");
  });

  it("produce slug stabili", () => {
    expect(slugify("FC Internazionale Milano")).toBe("fc-internazionale-milano");
    expect(slugify("M'gladbach & Co.")).toBe("mgladbach-and-co");
  });
});
