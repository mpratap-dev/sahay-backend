import { InterestArea } from '../generated/prisma/enums';

export const INTEREST_AREA_LABELS: Record<InterestArea, string> = {
  [InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING]:
    'Technology, Science & Engineering',
  [InterestArea.BUSINESS_FINANCE_ENTREPRENEURSHIP]:
    'Business, Finance & Entrepreneurship',
  [InterestArea.LAW_GOVERNMENT_PUBLIC_SERVICES]:
    'Law, Government & Public Services',
  [InterestArea.EDUCATION_HEALTHCARE_MEDIA_LIFESTYLE]:
    'Education, Healthcare, Media & Lifestyle',
};

/** V1: auto-followed via `replaceInterestAreas`; later AI curation may refine. */
export const INTEREST_AREA_TOPIC_SLUGS: Record<
  InterestArea,
  readonly string[]
> = {
  [InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING]: ['technology', 'science'],
  [InterestArea.BUSINESS_FINANCE_ENTREPRENEURSHIP]: [
    'business',
    'economy',
    'employment',
    'agriculture',
  ],
  [InterestArea.LAW_GOVERNMENT_PUBLIC_SERVICES]: [
    'government',
    'politics',
    'judiciary',
    'municipal',
  ],
  [InterestArea.EDUCATION_HEALTHCARE_MEDIA_LIFESTYLE]: [
    'education',
    'health',
    'entertainment',
    'culture',
  ],
};
