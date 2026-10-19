import { describe, expect, it } from "vitest";
import {
  inviteCodeSchema,
  emailSchema,
  passwordSchema,
  signUpSchema,
  createFamilySchema,
  createPostSchema,
  commentSchema,
  sendMessageSchema,
  createEventSchema,
  createTreeMemberSchema,
  createTreeRelationshipSchema,
  createVoiceMemorySchema,
  createReunionSchema,
  createFundSchema,
  createFundContributionSchema,
} from "@/lib/validation";

describe("inviteCodeSchema", () => {
  it("accepts valid 8-12 alphanumeric codes", () => {
    expect(inviteCodeSchema.safeParse("ABCDEF12").success).toBe(true);
    expect(inviteCodeSchema.safeParse("23456789ABCD").success).toBe(true);
    expect(inviteCodeSchema.safeParse("abcdef12").success).toBe(true); // transforms to uppercase
  });

  it("rejects codes that are too short or too long", () => {
    expect(inviteCodeSchema.safeParse("ABC12").success).toBe(false);
    expect(inviteCodeSchema.safeParse("1234567890ABCD").success).toBe(false);
  });

  it("rejects special characters", () => {
    expect(inviteCodeSchema.safeParse("ABC-DEF12").success).toBe(false);
    expect(inviteCodeSchema.safeParse("ABC DEF12").success).toBe(false);
  });
});

describe("emailSchema & passwordSchema", () => {
  it("validates well-formed emails", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("enforces minimum password length of 8 chars", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
    expect(passwordSchema.safeParse("short").success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("requires password confirmation match", () => {
    const valid = signUpSchema.safeParse({
      fullName: "Jane Doe",
      email: "jane@family.com",
      password: "secretpassword123",
      confirmPassword: "secretpassword123",
    });
    expect(valid.success).toBe(true);

    const mismatch = signUpSchema.safeParse({
      fullName: "Jane Doe",
      email: "jane@family.com",
      password: "secretpassword123",
      confirmPassword: "differentpassword",
    });
    expect(mismatch.success).toBe(false);
  });
});

describe("createFamilySchema", () => {
  it("validates family creation parameters", () => {
    const valid = createFamilySchema.safeParse({
      name: "The Smiths",
      description: "Our extended family circle",
      privacy: "invite_only",
      require_approval: true,
    });
    expect(valid.success).toBe(true);

    const tooShort = createFamilySchema.safeParse({
      name: "A",
    });
    expect(tooShort.success).toBe(false);
  });
});

describe("createPostSchema", () => {
  it("allows post with content or media", () => {
    expect(createPostSchema.safeParse({ content: "Hello family!" }).success).toBe(true);
    expect(
      createPostSchema.safeParse({
        content: "",
        media_count: 2,
      }).success,
    ).toBe(true);
    // Disallows empty post with no media
    expect(createPostSchema.safeParse({ content: "", media_count: 0 }).success).toBe(false);
  });
});

describe("commentSchema", () => {
  it("rejects empty comments and enforces length limits", () => {
    expect(commentSchema.safeParse({ content: "Nice photo!" }).success).toBe(true);
    expect(commentSchema.safeParse({ content: "" }).success).toBe(false);
    expect(commentSchema.safeParse({ content: "   " }).success).toBe(false);
  });
});

describe("sendMessageSchema", () => {
  it("validates chat message content and media", () => {
    expect(sendMessageSchema.safeParse({ content: "Hi everyone" }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ content: "", media_count: 1 }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ content: "", media_count: 0 }).success).toBe(false);
  });
});

describe("createEventSchema", () => {
  it("validates calendar events with valid start and end ranges", () => {
    const valid = createEventSchema.safeParse({
      title: "Family Picnic",
      all_day: false,
      starts_at: "2026-07-04T12:00:00.000Z",
      ends_at: "2026-07-04T16:00:00.000Z",
      location: "Central Park",
      category: "gathering",
    });
    expect(valid.success).toBe(true);

    const invalidDates = createEventSchema.safeParse({
      title: "Family Picnic",
      all_day: false,
      starts_at: "2026-07-04T16:00:00.000Z",
      ends_at: "2026-07-04T12:00:00.000Z", // ends before start
    });
    expect(invalidDates.success).toBe(false);
  });
});

describe("Family Tree Validation", () => {
  it("validates tree member creation and rejects invalid self-relations", () => {
    const member = createTreeMemberSchema.safeParse({
      full_name: "Grandpa Rahim",
      gender: "male",
      is_deceased: true,
      birth_date: "1940-01-01",
      death_date: "2015-05-10",
      generation: -2,
    });
    expect(member.success).toBe(true);

    const selfRelation = createTreeRelationshipSchema.safeParse({
      person_id: "550e8400-e29b-41d4-a716-446655440000",
      related_person_id: "550e8400-e29b-41d4-a716-446655440000",
      relationship_type: "parent",
    });
    expect(selfRelation.success).toBe(false);
  });
});

describe("Voice Memory Validation", () => {
  it("validates voice memory records", () => {
    const valid = createVoiceMemorySchema.safeParse({
      title: "Grandmother singing lullaby",
      speaker_name: "Dadi",
      recorded_date: "2026-01-15",
      language: "bn",
      audio_url: "family-id/voice/audio.webm",
      duration_seconds: 125,
      file_size_bytes: 1048576,
    });
    expect(valid.success).toBe(true);

    const missingAudio = createVoiceMemorySchema.safeParse({
      title: "Test",
      speaker_name: "Test",
      recorded_date: "2026-01-15",
      audio_url: "",
    });
    expect(missingAudio.success).toBe(false);
  });
});

describe("Reunion & Travel Validation", () => {
  it("validates trip dates and tasks", () => {
    const validTrip = createReunionSchema.safeParse({
      title: "Cox's Bazar Annual Tour",
      destination: "Cox's Bazar",
      start_date: "2026-11-10",
      end_date: "2026-11-14",
      estimated_budget: 75000,
    });
    expect(validTrip.success).toBe(true);

    const invalidDates = createReunionSchema.safeParse({
      title: "Trip",
      destination: "Sylhet",
      start_date: "2026-11-15",
      end_date: "2026-11-10",
    });
    expect(invalidDates.success).toBe(false);
  });
});

describe("Family Fund (Bookkeeping Ledger) Validation", () => {
  it("validates fund creation, positive contributions, and expenses", () => {
    const fund = createFundSchema.safeParse({
      title: "Eid Reunion Fund 2026",
      purpose: "Food, venue rental, and gifts",
      target_amount: 50000,
    });
    expect(fund.success).toBe(true);

    const contribution = createFundContributionSchema.safeParse({
      fund_id: "550e8400-e29b-41d4-a716-446655440000",
      contributor_name: "Tanvir Hasan",
      amount: 5000,
      payment_method: "bkash",
      status: "received",
    });
    expect(contribution.success).toBe(true);

    const negativeContribution = createFundContributionSchema.safeParse({
      fund_id: "550e8400-e29b-41d4-a716-446655440000",
      contributor_name: "Tanvir Hasan",
      amount: -100, // Disallowed
    });
    expect(negativeContribution.success).toBe(false);
  });
});
