import {
  submitOfficialInquirySchema,
  updateOfficialInquiryStatusSchema,
} from '../src/modules/official-inquiries/official-inquiries.validation.js';

describe('official inquiry validation', () => {
  const validSubmission = {
    body: {
      fullName: 'Amina Ahmed',
      phone: '+251 91 234 5678',
      email: '',
      inquiryType: 'General',
      department: 'General Secretariat',
      message: 'Please advise me about a council service.',
    },
  };

  it('accepts a complete inquiry with an optional empty email', () => {
    expect(submitOfficialInquirySchema.safeParse(validSubmission).success).toBe(true);
  });

  it('rejects unknown inquiry categories and invalid contact details', () => {
    expect(submitOfficialInquirySchema.safeParse({
      body: { ...validSubmission.body, inquiryType: 'Unknown', phone: 'bad' },
    }).success).toBe(false);
  });

  it('accepts only supported inquiry workflow statuses', () => {
    expect(updateOfficialInquiryStatusSchema.safeParse({
      params: { id: '10' },
      body: { status: 'UNDER_REVIEW' },
    }).success).toBe(true);
    expect(updateOfficialInquiryStatusSchema.safeParse({
      params: { id: '10' },
      body: { status: 'APPROVED' },
    }).success).toBe(false);
  });
});
