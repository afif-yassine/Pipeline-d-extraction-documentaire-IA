import { z } from "zod";

// Source de vérité unique : ces schémas servent à la fois
// - à imposer le format de réponse au LLM (z.toJSONSchema, dans mistral.ts),
// - à vérifier cette réponse pendant l'exécution (safeParse, dans processInvoice.ts),
// - à vérifier results.json dans l'interface (App.tsx),
// - à fabriquer les types TypeScript (z.infer, en bas du fichier).

// Un avertissement est toujours rattaché à un champ, pour que l'interface l'affiche au bon endroit.
export const WarningSchema = z.object({
  field: z.string(), // ex. "totalTTC" ou "lineItems[2]"
  message: z.string(), // ex. "Montant illisible sur le scan"
});

export const LineItemSchema = z.object({
  description: z.string().nullable(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(), // en euros, HT
  lineTotal: z.number().nullable(), // total TEL QU'IMPRIMÉ : sert au contrôle, jamais recalculé
});

// Ce que le LLM doit renvoyer pour une facture.
// Tout est nullable : le LLM a le droit de dire « je ne sais pas » au lieu d'inventer.
export const ExtractedInvoiceSchema = z.object({
  supplierName: z.string().nullable(),
  invoiceDate: z.string().nullable(), // AAAA-MM-JJ attendu, vérifié ensuite (normalize.ts)
  invoiceNumber: z.string().nullable(),
  lineItems: z.array(LineItemSchema).nullable(), // null = tableau illisible, [] = aucune ligne
  totalHT: z.number().nullable(),
  totalTVA: z.number().nullable(), // sert au contrôle HT + TVA = TTC
  totalTTC: z.number().nullable(),
  warnings: z.array(WarningSchema), // [] = aucun avertissement, pas besoin de null
});

export const CheckSchema = z.object({
  name: z.string(), // ex. "Somme des lignes = total HT"
  status: z.enum(["ok", "mismatch", "not_verifiable"]),
  message: z.string(),
});

// Le résultat pour UN fichier PDF : soit un succès, soit un échec, jamais les deux.
// Le champ "status" permet à TypeScript de savoir lequel des deux on manipule.
export const InvoiceResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    sourceFile: z.string(), // provenance : le PDF d'où vient la donnée
    data: ExtractedInvoiceSchema,
    checks: z.array(CheckSchema),
  }),
  z.object({
    status: z.literal("error"),
    sourceFile: z.string(),
    error: z.string(), // message lisible par un comptable
  }),
]);

// Le fichier results.json entier : écrit par le pipeline, relu et revalidé par l'interface.
export const ResultsFileSchema = z.object({
  generatedAt: z.string(), // date ISO du traitement
  invoices: z.array(InvoiceResultSchema),
});

export type Warning = z.infer<typeof WarningSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;
export type Check = z.infer<typeof CheckSchema>;
export type InvoiceResult = z.infer<typeof InvoiceResultSchema>;
export type ResultsFile = z.infer<typeof ResultsFileSchema>;
