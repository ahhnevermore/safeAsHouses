export type publicID = string & { readonly __brand: "publicID" };
export type ID = string & { readonly __brand: "ID" };
export type tileID = string & { readonly __brand: "tileID" };
export type unitID = number & { readonly __brand: "unitID" };
export type roomID = string & { readonly __brand: "roomID" };
export type cardID = string & { readonly __brand: "cardID" };
export type colour = number & { readonly __brand: "colour" };
export type coins = number & { readonly __brand: "coins" };
