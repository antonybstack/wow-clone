import assert from "node:assert/strict";
import test from "node:test";
import {
  HDR_FORMAT,
  srgbToLinear,
  linearToSrgb,
  displayColor,
} from "../src/ashen-reach/color-management.js";

const near = (actual, expected, tolerance = 1e-7) => {
  assert.ok(Number.isFinite(actual), `expected finite value, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`);
};
const gray = (value, options) => displayColor([value, value, value], options);

test("scene color uses a floating-point HDR attachment", () => {
  assert.equal(HDR_FORMAT, "rgba16float");
});

test("sRGB transfer functions preserve black and white and clamp negative input", () => {
  for (const transfer of [srgbToLinear, linearToSrgb]) {
    near(transfer(0), 0);
    near(transfer(1), 1);
    near(transfer(-0.25), 0);
  }
});

test("sRGB transfer agrees with reference midtones and both curve joins", () => {
  near(srgbToLinear(0.5), 0.21404114048223255);
  near(linearToSrgb(0.18), 0.46135612950044164);
  near(srgbToLinear(0.04045), 0.0031308049535603713);
  near(linearToSrgb(0.0031308), 0.040449936);
  near(srgbToLinear(0.04045 - 1e-9), srgbToLinear(0.04045 + 1e-9));
  near(linearToSrgb(0.0031308 - 1e-9), linearToSrgb(0.0031308 + 1e-9));
});

test("sRGB round trips cover every byte value and linear HDR values", () => {
  for (let byte = 0; byte <= 255; byte++) {
    const encoded = byte / 255;
    near(linearToSrgb(srgbToLinear(encoded)), encoded);
  }
  for (const linear of [0, 1e-6, 0.0031308, 0.018, 0.18, 0.5, 1, 2, 4, 16, 65504]) {
    near(srgbToLinear(linearToSrgb(linear)), linear, 1e-7 * Math.max(1, linear));
  }
  assert.ok(linearToSrgb(4) > 1, "transfer encoding must not clip HDR input");
});

test("transfer functions are finite and monotonic across shadows, midtones and HDR", () => {
  const samples = [-1, 0, 1e-6, 0.001, 0.003, 0.01, 0.04, 0.05, 0.18, 0.5, 1, 2, 16, 65504];
  for (const transfer of [srgbToLinear, linearToSrgb]) {
    let previous = -Infinity;
    for (const input of samples) {
      const output = transfer(input);
      assert.ok(Number.isFinite(output));
      assert.ok(output >= previous, `transfer decreased at ${input}`);
      previous = output;
    }
  }
});

test("display output stays finite and bounded throughout the half-float radiance range", () => {
  const colors = [[0, 0, 0], [-1, -0.1, -4], [1e-6, 0.003, 0.01],
    [0.18, 0.18, 0.18], [2.7, 0.32, 0.012], [16, 1, 0], [65504, 32752, 65504]];
  for (const exposure of [0, 0.05, 0.9, 1, 4]) {
    for (const saturation of [0, 1, 1.05, 1.5]) {
      for (const rgb of colors) {
        const output = displayColor(rgb, { exposure, saturation });
        assert.equal(output.length, 3);
        for (const channel of output) {
          assert.ok(Number.isFinite(channel) && channel >= 0 && channel <= 1,
            `invalid display channel ${channel} for ${rgb}, exposure ${exposure}`);
        }
      }
    }
  }
  assert.deepEqual(gray(0), [0, 0, 0]);
  assert.deepEqual(displayColor([4, 2, 1], { exposure: 0 }), [0, 0, 0]);
});

test("display luminance is monotonic and keeps a neutral ramp neutral", () => {
  let previous = -Infinity;
  for (const radiance of [0, 1e-6, 0.001, 0.01, 0.05, 0.18, 0.5, 1, 2, 4, 8, 16, 65504]) {
    const [r, g, b] = gray(radiance);
    near(r, g);
    near(g, b);
    assert.ok(r >= previous, `display luminance decreased at ${radiance}`);
    previous = r;
  }
});

test("exposure brightens midtones and scales radiance before the display transform", () => {
  const outputs = [0.25, 0.5, 1, 2, 4].map(exposure => gray(0.18, { exposure })[0]);
  for (let i = 1; i < outputs.length; i++) assert.ok(outputs[i] > outputs[i - 1]);
  const source = Object.freeze([0.2, 0.05, 0.0125]);
  const exposed = displayColor(source, { exposure: 2, saturation: 1 });
  const scaled = displayColor(source.map(v => v * 2), { exposure: 1, saturation: 1 });
  exposed.forEach((v, i) => near(v, scaled[i]));
  assert.deepEqual(source, [0.2, 0.05, 0.0125]);
});

test("above-one highlights remain distinguishable after display conversion", () => {
  const one = gray(1)[0];
  const two = gray(2)[0];
  const four = gray(4)[0];
  assert.ok(one < two && two < four && four < 1,
    `HDR highlights collapsed: ${[one, two, four]}`);
  assert.ok(two - one > 0.01 && four - two > 0.01,
    "highlight differences should survive display quantization");
  const [r, g, b] = displayColor([2.7, 0.32, 0.012]);
  assert.ok(r > g && g > b, "warm emission should retain channel separation");
});
