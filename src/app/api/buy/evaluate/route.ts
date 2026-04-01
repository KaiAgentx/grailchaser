import { NextRequest, NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const { askingPrice, rawValue, gradedValues, gemProbability, platform = "eBay" } = await request.json();
    if (askingPrice === undefined || askingPrice === null || rawValue === undefined || rawValue === null) {
      return NextResponse.json({ error: "Need askingPrice and rawValue" }, { status: 400 });
    }
    const p = PLATFORMS.find(pl => pl.name === platform) || PLATFORMS[0];
    const shipping = rawValue >= 20 ? 4.50 : 1.05;
    const platformFee = rawValue * p.feeRate + p.fixedFee;
    const paymentFee = rawValue * p.paymentFee + p.paymentFixed;
    const totalFees = platformFee + paymentFee;
    const flipNet = rawValue - totalFees - shipping;
    const flipProfit = flipNet - askingPrice;
    const flipROI = askingPrice > 0 ? (flipProfit / askingPrice) * 100 : 0;
    const gradeCost = 25;
    const psa10 = gradedValues?.["10"] || rawValue * 3;
    const psa9 = gradedValues?.["9"] || rawValue * 1.8;
    const psa8 = gradedValues?.["8"] || rawValue * 1.2;
    const psa7 = gradedValues?.["7"] || rawValue * 0.9;
    const gem = gemProbability || 0.15;
    const gradeDistribution = [
      { grade: "10", value: psa10, prob: gem },
      { grade: "9", value: psa9, prob: 0.35 },
      { grade: "8", value: psa8, prob: 0.30 },
      { grade: "7", value: psa7, prob: 0.15 },
      { grade: "lower", value: rawValue * 0.7, prob: Math.max(0, 1 - gem - 0.80) },
    ];
    const expectedGradedValue = gradeDistribution.reduce((sum, g) => sum + (g.value * g.prob), 0);
    const gradedFees = expectedGradedValue * p.feeRate + p.fixedFee + (expectedGradedValue * p.paymentFee) + p.paymentFixed;
    const gradeNet = expectedGradedValue - gradedFees - shipping - gradeCost;
    const gradeProfit = gradeNet - askingPrice;
    const gradeROI = askingPrice > 0 ? (gradeProfit / askingPrice) * 100 : 0;
    const gradeScenarios = gradeDistribution.map(g => {
      const fees = g.value * p.feeRate + p.fixedFee + (g.value * p.paymentFee) + p.paymentFixed;
      const net = g.value - fees - shipping - gradeCost - askingPrice;
      return { grade: g.grade, value: +g.value.toFixed(2), probability: +(g.prob * 100).toFixed(1), profit: +net.toFixed(2) };
    });
    const maxPayBreakEven = +flipNet.toFixed(2);
    const maxPayTarget = +(flipNet / 1.2).toFixed(2);
    const maxPayGrade = +gradeNet.toFixed(2);
    const belowMarket = +((1 - askingPrice / rawValue) * 100).toFixed(1);
    let verdict: "buy" | "negotiate" | "pass";
    let reason: string;
    if (flipROI > 20) {
      verdict = "buy"; reason = belowMarket + "% below market, solid flip margin";
    } else if (flipROI > 0 || gradeROI > 30) {
      verdict = "negotiate"; reason = "Tight on raw flip - try offering $" + maxPayTarget;
    } else {
      verdict = "pass"; reason = "Overpaying - max $" + maxPayBreakEven + " to break even";
    }
    return NextResponse.json({
      askingPrice, rawValue, belowMarket,
      flip: { net: +flipNet.toFixed(2), profit: +flipProfit.toFixed(2), roi: +flipROI.toFixed(1), fees: +totalFees.toFixed(2), shipping, platform: p.name },
      grade: { expectedValue: +expectedGradedValue.toFixed(2), net: +gradeNet.toFixed(2), profit: +gradeProfit.toFixed(2), roi: +gradeROI.toFixed(1), cost: gradeCost, gemProbability: +(gem * 100).toFixed(1), scenarios: gradeScenarios },
      maxPay: { breakEven: maxPayBreakEven, target20: maxPayTarget, gradeBreakEven: maxPayGrade },
      verdict, reason,
    });
  } catch (error) {
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
