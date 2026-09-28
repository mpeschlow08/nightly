export type DevelopmentDatabaseIdentity = {
  hostname: string;
  projectId: string | null | undefined;
  branchId: string | null | undefined;
  endpointId: string | null | undefined;
  databaseName: string | null | undefined;
};

export function developmentDatabaseIdentityFailure(identity: DevelopmentDatabaseIdentity): string | null {
  if (!identity.hostname.startsWith("ep-silent-hat-")) return "hostname_mismatch";
  if (identity.hostname.includes("ep-rough-mud-")) return "production_hostname_forbidden";
  if (identity.projectId !== "old-tooth-16761666") return "project_mismatch";
  if (identity.branchId === "br-dry-dew-at2z1st2") return "production_branch_forbidden";
  if (identity.branchId !== "br-tiny-recipe-atpyb85n") return "branch_mismatch";
  if (identity.endpointId === "ep-rough-mud-atcx5jvx") return "production_endpoint_forbidden";
  if (identity.endpointId !== "ep-silent-hat-at3rhpgq") return "endpoint_mismatch";
  if (identity.databaseName !== "neondb") return "database_mismatch";
  return null;
}