/** Creator application (TSD GĐ1 §4.1 `Application`). */
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type CreatorApplication = {
  id: string
  status: ApplicationStatus
  legalName: string
  birthDate: string
  note: string | null
  rejectReason: string | null
  createdAt: string
  reviewedAt: string | null
}

export type ApplicationInput = {
  legalName: string
  birthDate: string
  note?: string
  acceptCreatorTerms: boolean
}
