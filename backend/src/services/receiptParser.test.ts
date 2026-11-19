import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeReceiptPayload, parseReceiptNumber } from "./receiptParser.js";

interface ReceiptFixture {
  name: string;
  input: unknown;
  expected: {
    names: string[];
    quantities: number[];
    unitPrices: number[];
    grandTotal: number;
    tax?: number;
    hasWarnings?: boolean;
  };
}

const fixtures = JSON.parse(
  readFileSync(new URL("../../src/services/fixtures/receipt-cases.json", import.meta.url), "utf8")
) as ReceiptFixture[];

for (const fixture of fixtures) {
  test(`receipt normalization: ${fixture.name}`, () => {
    const parsed = normalizeReceiptPayload(fixture.input);
    assert.ok(parsed);
    assert.deepEqual(parsed.items.map((item) => item.name), fixture.expected.names);
    assert.deepEqual(parsed.items.map((item) => item.quantity), fixture.expected.quantities);
    assert.deepEqual(parsed.items.map((item) => item.unitPrice), fixture.expected.unitPrices);
    assert.equal(parsed.summary.grandTotal, fixture.expected.grandTotal);
    if (fixture.expected.tax !== undefined) assert.equal(parsed.summary.tax, fixture.expected.tax);
    if (fixture.expected.hasWarnings) assert.ok((parsed.warnings?.length ?? 0) > 0);
  });
}

test("receipt number parsing distinguishes decimals from grouped thousands", () => {
  assert.equal(parseReceiptNumber("120 020"), 120020);
  assert.equal(parseReceiptNumber("120,020"), 120020);
  assert.equal(parseReceiptNumber("1 200,50"), 1200.5);
  assert.equal(parseReceiptNumber("1,200.50"), 1200.5);
  assert.equal(parseReceiptNumber("not a price"), null);
});
