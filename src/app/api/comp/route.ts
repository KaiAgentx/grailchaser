import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { player, year, set, parallel } = await request.json();
    const appId = process.env.EBAY_APP_ID;
    if (!appId) {
      return NextResponse.json({ comps: [], message: "No eBay API key configured" });
    }
    const query = encodeURIComponent([year, set, parallel, player].filter(Boolean).join(" "));
    const url = "https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=" + appId + "&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&keywords=" + query + "&categoryId=261328&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true&sortOrder=EndTimeSoonest&paginationInput.entriesPerPage=10";
    const res = await fetch(url);
    const data = await res.json();
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    const comps = items.map((item: any) => ({
      title: item.title?.[0],
      price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || "0"),
      date: item.listingInfo?.[0]?.endTime?.[0],
      url: item.viewItemURL?.[0],
    }));
    return NextResponse.json({ comps });
  } catch (error) {
    return NextResponse.json({ error: "Comp lookup failed" }, { status: 500 });
  }
}
