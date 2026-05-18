import { prisma } from "../prisma";

export type CompanyHeader = {
  name: string;
  address: string;
  phone: string;
  fax: string;
  ein: string;
};

const EMPTY: CompanyHeader = { name: "", address: "", phone: "", fax: "", ein: "" };

export async function loadCompanyForCase(caseId: string | null | undefined): Promise<CompanyHeader> {
  if (!caseId) return EMPTY;
  const patientCase = await prisma.patientCase.findUnique({
    where: { id: caseId },
    include: { company: true },
  });
  const c = patientCase?.company;
  if (!c) return EMPTY;
  return {
    name: c.name || "",
    address: c.address || "",
    phone: c.phone || "",
    fax: c.fax || "",
    ein: c.ein || "",
  };
}
