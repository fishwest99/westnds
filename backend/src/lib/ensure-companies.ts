import { prisma } from "../prisma";

export async function ensureDefaultCompanies(): Promise<void> {
  await prisma.company.upsert({
    where: { slug: "services" },
    create: { slug: "services", name: "West Neurodiagnostic Services" },
    update: {},
  });
  await prisma.company.upsert({
    where: { slug: "reading" },
    create: { slug: "reading", name: "West Neurodiagnostic Reading" },
    update: {},
  });
}
