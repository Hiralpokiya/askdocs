import OpenAI from "openai";

let client: OpenAI | null = null;

// Created on first use, so builds don't need OPENAI_API_KEY
export function getOpenAI() {
  if (!client) client = new OpenAI();
  return client;
}
