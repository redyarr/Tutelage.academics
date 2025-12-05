'use client'

import { FileText as FileTextIcon, ExternalLink as ExternalLinkIcon,ExternalLink, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BASE_URL from '@/app/config/url'

/**
 * Reusable PDF Button Component with Open/Download actions
 * @param {string} pdfUrl - Raw PDF URL
 * @param {function} onOpen - Handler to open PDF in modal
 * @param {string} label - Button label (default: "Resource PDF")
 * @param {boolean} showDownload - Show download button (default: true)
 * @param {boolean} showExternalLink - Show external link (default: true)
 */
export default function PdfButton({ 
  pdfUrl, 
  onOpen, 
  label = "Resource PDF",
  showDownload = true,
  showExternalLink = true
}) {
  if (!pdfUrl) return null

  const toPdfView = (u) => `${BASE_URL}/api/pdf/view?url=${encodeURIComponent(u)}`

  // Extract filename from URL
  const extractFilename = (url) => {
    try {
      return decodeURIComponent(new URL(url).pathname.split('/').pop())
    } catch {
      return 'document.pdf'
    }
  }

  return (
    <div className="flex items-center justify-between gap-6 p-4 border rounded-md bg-card w-fit">
      <div className="flex items-center gap-3">
        <FileTextIcon className="w-6 h-6 text-primary" />
        <div>
          <div className="font-semibold text-foreground">{label}</div>
          <div className="text-sm text-muted-foreground">
            {extractFilename(pdfUrl)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => onOpen(pdfUrl)} className="gap-2">
          <ExternalLinkIcon className="w-4 h-4" />Open
        </Button>
        {showDownload && (
          <a 
            href={pdfUrl} 
            download 
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
        {showExternalLink && (
          <a 
            href={toPdfView(pdfUrl)} 
            target="_blank" 
            rel="noreferrer" 
            className="text-muted-foreground px-2"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  )
}
