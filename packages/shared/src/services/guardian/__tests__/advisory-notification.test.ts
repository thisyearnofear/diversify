import { describe, expect, it } from 'vitest';
import { AutomationService } from '../../automation-service';
import { GuardianRecommendationService } from '../guardian-recommendation.service';

describe('unavailable estimates in advisory notifications', () => {
  it('does not advertise savings, unknown risk as low, or a fabricated zero', () => {
    const analysis = GuardianRecommendationService.buildFinalResult({
      recommendation: {}, dataSources: [], paymentHashes: {}, steps: [],
    });
    // Test the pure formatter without configuring or sending any notification.
    const service = Object.create(AutomationService.prototype) as any;
    const email = service.generateEmailContent({
      analysis, user: { portfolio: { balance: 100 }, email: 'test@example.com' },
      metadata: { costIncurred: 0 },
    });
    expect(email.subject).not.toContain('Save $');
    expect(email.text).toContain('Unavailable; no validated savings calculation');
    expect(email.text).toContain('Risk Level: UNKNOWN');
    expect(email.html).not.toMatch(/\$undefined|\$0 saved/);
  });
});
