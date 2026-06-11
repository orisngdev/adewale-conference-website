import type { SchemaTypeDefinition } from "sanity";
import { edition } from "./edition";
import { result } from "./result";
import { resource } from "./resource";
import { newsPost } from "./newsPost";
import { galleryItem } from "./galleryItem";
import { sponsor } from "./sponsor";
import { person } from "./person";
import { siteSettings } from "./siteSettings";

export const schemaTypes: SchemaTypeDefinition[] = [
  edition,
  result,
  resource,
  newsPost,
  galleryItem,
  sponsor,
  person,
  siteSettings,
];
