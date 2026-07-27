import type { Page } from './site.js';
import type { Sbom } from './open-source-data.js';
import { homePage } from './content/home.js';
import { productPage } from './content/product.js';
import { architectsPage } from './content/architects.js';
import { studentsPage } from './content/students.js';
import { collaborationPage } from './content/collaboration.js';
import { aiPage } from './content/ai.js';
import { interoperabilityPage } from './content/interoperability.js';
import { ipadPage } from './content/ipad.js';
import { pricingPage } from './content/pricing.js';
import { securityPage } from './content/security.js';
import { docsIndexPage } from './content/docs-index.js';
import { changelogPage } from './content/changelog.js';
import { statusPage } from './content/status.js';
import { contactPage } from './content/contact.js';
import { privacyPage } from './content/privacy.js';
import { termsPage } from './content/terms.js';
import { openSourcePage } from './content/open-source.js';
import { notFoundPage } from './content/not-found.js';

/**
 * All sheets in the public set, in ROUTE-MAP order (PUB-001..PUB-017) plus
 * the not-found sheet. The open-source page is the one page built from data,
 * so the registry is a function of the SBOM.
 */
export function allPages(sbom: Sbom): readonly Page[] {
  return [
    homePage,
    productPage,
    architectsPage,
    studentsPage,
    collaborationPage,
    aiPage,
    interoperabilityPage,
    ipadPage,
    pricingPage,
    securityPage,
    docsIndexPage,
    changelogPage,
    statusPage,
    contactPage,
    privacyPage,
    termsPage,
    openSourcePage(sbom),
    notFoundPage,
  ];
}
