/** Case- and accent-insensitive search key, with Turkish dotless ı folded to i. */
export function searchKey(s: string, locale: string): string {
  return s
    .toLocaleLowerCase(locale)
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
