export const GENDER_OPTIONS = ["Male", "Female"] as const;
export const CLASS_OPTIONS = ["SS 1", "SS 2"] as const;
export const SCHOOL_CATEGORY_OPTIONS = ["Public", "Private"] as const;
export const YES_NO_OPTIONS = ["Yes", "No"] as const;
export const LGA_OPTIONS = [
  "Abeokuta North",
  "Abeokuta South",
  "Ado-Odo/Ota",
  "Ewekoro",
  "Ifo",
  "Ijebu North East",
  "Ijebu North",
  "Ijebu Ode",
  "Ijebu East",
  "Ikenne",
  "Imeko Afon",
  "Ipokia",
  "Obafemi Owode",
  "Odeda",
  "Odogbolu",
  "Ogun Waterside",
  "Remo North",
  "Sagamu",
  "Yewa North",
  "Yewa South",
] as const;
// The centre values written by the school registration form and read back by the
// admin allocation screens. These are the towns used up to 2025, and historical
// `qualification_zone` rows hold exactly these strings — `isKnownCentre` in the
// admin participants page treats anything outside this list as "not a centre".
// Do not repoint this at the 2026 school names below without first migrating the
// stored values, or every past allocation reads as unallocated.
export const ZONAL_FINALS_OPTIONS = [
  "Abeokuta",
  "Ayetoro",
  "Idiroko",
  "Ifo",
  "Ilaro",
  "Ijebu Ode",
  "Ota",
  "Sagamu",
] as const;

// The ten venues hosting the 2026 Zonal Finals, named by school rather than by
// town — two centres (Arigbajo, Imeko) are new for 2026, and Iko Gateway replaces
// Idiroko. Used by the public Fellows pages; kept separate from
// ZONAL_FINALS_OPTIONS above until the stored centre values are migrated.
export const ZONAL_CENTRES_2026 = [
  { school: "Abeokuta Grammar School", town: "Abeokuta" },
  { school: "Ansar Ud Deen Comprehensive Senior College", town: "Ota" },
  { school: "Pakoto High School", town: "Ifo" },
  { school: "Iko Gateway Grammar School", town: "Iko" },
  { school: "Methodist High School", town: "Arigbajo" },
  { school: "Comprehensive High School", town: "Ayetoro" },
  { school: "Yewa (Egbado) College, Senior", town: "Ilaro" },
  { school: "Nazareth High School", town: "Imeko" },
  { school: "Methodist Comprehensive College, Senior", town: "Sagamu" },
  { school: "Adeola Odutola College", town: "Ijebu Ode" },
] as const;

/** How a centre is written wherever one value is needed — a form option, a
 *  spreadsheet cell. Pairs the school with its town, since three of the school
 *  names repeat across towns. */
export function centreLabel(centre: (typeof ZONAL_CENTRES_2026)[number]) {
  return `${centre.school}, ${centre.town}`;
}

export const ZONAL_CENTRE_2026_OPTIONS = ZONAL_CENTRES_2026.map(centreLabel);
export const SPONSORSHIP_TIER_OPTIONS = [
  "Platinum - ₦10M+",
  "Gold - ₦5M",
  "Silver - ₦2.5M",
  "Bronze - ₦1M",
  "Scholarship Sponsor - From ₦500k",
  "Not sure yet - Send me the full deck",
] as const;

export const initialRegistrationFormData = {
  studentRep1FullName: "",
  studentRep1DOB: "",
  studentRep1Gender: "",
  studentRep1Class: "",
  studentRep1GuardianName: "",
  studentRep1GuardianNumber: "",
  studentRep2FullName: "",
  studentRep2DOB: "",
  studentRep2Gender: "",
  studentRep2Class: "",
  studentRep2GuardianName: "",
  studentRep2GuardianNumber: "",
  studentRep3FullName: "",
  studentRep3DOB: "",
  studentRep3Gender: "",
  studentRep3Class: "",
  studentRep3GuardianName: "",
  studentRep3GuardianNumber: "",
  schoolLGA: "",
  schoolCategory: "",
  schoolSource: "existing",
  schoolFullName: "",
  schoolAddress: "",
  schoolEmail: "",
  hearAboutAdewale: "",
  zonalFinalsLocation: "",
  principalFullName: "",
  principalGender: "",
  principalNumber: "",
  principalEmail: "",
  teacherFullName: "",
  teacherGender: "",
  teacherNumber: "",
  teacherEmail: "",
  participatedLastEdition: "",
  likesAboutLastEdition: "",
  expectationFromLastEdition: "",
};

export type RegistrationFormData = typeof initialRegistrationFormData;

// Maps the camelCase registration form onto the Airtable field names. This is the
// canonical shape stored in `registrations.details` (jsonb) — both the public
// route (Airtable write) and the portal mirror use it, so a freshly-submitted
// entry carries the same rich detail the Airtable sync would later refresh.
export function mapRegistrationFields(data: RegistrationFormData) {
  return {
    "Student Rep 1 Full Name": data.studentRep1FullName,
    "Student Rep 1 DOB": data.studentRep1DOB,
    "Student Rep 1 Gender": data.studentRep1Gender,
    "Student Rep 1 Class": data.studentRep1Class,
    "Student Rep 1 Guardian Name": data.studentRep1GuardianName,
    "Student Rep 1 Guardian Number": data.studentRep1GuardianNumber,
    "Student Rep 2 Full Name": data.studentRep2FullName,
    "Student Rep 2 DOB": data.studentRep2DOB,
    "Student Rep 2 Gender": data.studentRep2Gender,
    "Student Rep 2 Class": data.studentRep2Class,
    "Student Rep 2 Guardian Name": data.studentRep2GuardianName,
    "Student Rep 2 Guardian Number": data.studentRep2GuardianNumber,
    "Student Rep 3 Full Name": data.studentRep3FullName,
    "Student Rep 3 DOB": data.studentRep3DOB,
    "Student Rep 3 Gender": data.studentRep3Gender,
    "Student Rep 3 Class": data.studentRep3Class,
    "Student Rep 3 Guardian Name": data.studentRep3GuardianName,
    "Student Rep 3 Guardian Number": data.studentRep3GuardianNumber,
    "School LGA": data.schoolLGA,
    "School Category": data.schoolCategory,
    "School Full Name": data.schoolFullName,
    "School Address": data.schoolAddress,
    "School Email Address": data.schoolEmail,
    "Hear About Adewale": data.hearAboutAdewale,
    "Zonal Finals Location": data.zonalFinalsLocation,
    "Principal Full Name": data.principalFullName,
    "Principal Gender": data.principalGender,
    "Principal Number": data.principalNumber,
    "Principal Email Address": data.principalEmail,
    "Teacher Full Name": data.teacherFullName,
    "Teacher Gender": data.teacherGender,
    "Teacher Number": data.teacherNumber,
    "Teacher Email Address": data.teacherEmail,
    "School Participated In Last Edition": data.participatedLastEdition,
    "Likes About Last Edition": data.likesAboutLastEdition,
    "Expectation From Last Edition": data.expectationFromLastEdition,
  };
}

export const initialSponsorshipFormData = {
  org: "",
  contact: "",
  email: "",
  phone: "",
  tier: "",
  message: "",
};

export type SponsorshipFormData = typeof initialSponsorshipFormData;
