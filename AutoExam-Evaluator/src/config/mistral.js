import { Mistral } from "@mistralai/mistralai";

const apiKey = process.env.MISTRAL_API_KEY; // e.g. "dfasdasdfafdsadsfadfs"
export const client = new Mistral({ apiKey });
