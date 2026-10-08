/** Suggest keywords from a PDF's text (runs in the browser, loaded on demand). */
export async function suggestKeywordsFromPdf(file: File, onProgress?: (f: number) => void): Promise<string[]> {
    const [pdfjs, worker, extractor] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.mjs?url'),
        import('keyword-extractor'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + ' ';
        onProgress?.(i / pdf.numPages);
    }
    const words: string[] = extractor.default.extract(text, { language: 'english', remove_digits: true, return_changed_case: true, remove_duplicates: false });
    const counts = new Map<string, number>();
    for (const w of words) if (w.length > 3) counts.set(w, (counts.get(w) ?? 0) + 1);
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([w]) => w);
}
