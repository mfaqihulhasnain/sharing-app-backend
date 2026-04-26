import authValidation from "../../src/modules/auth/auth.validation.js";

const validEmail = "person@example.com";
const validPassword = "Aa1!abcd";

const getRegisterInput = (password = validPassword) => ({
  body: {
    email: validEmail,
    password,
  },
});

const getLoginInput = (password = validPassword) => ({
  body: {
    email: validEmail,
    password,
  },
});

describe("auth.validation", () => {
  test("register accepts a valid payload", () => {
    expect(() => authValidation.register.parse(getRegisterInput())).not.toThrow();
  });

  test("login accepts a valid payload", () => {
    expect(() => authValidation.login.parse(getLoginInput())).not.toThrow();
  });

  test.each([
    ["missing uppercase", "aa1!abcd"],
    ["missing lowercase", "AA1!ABCD"],
    ["missing number", "Aa!abcde"],
    ["missing special character", "Aa1abcde"],
  ])("register rejects password with %s", (_label, password) => {
    expect(() => authValidation.register.parse(getRegisterInput(password))).toThrow();
  });

  test.each([
    ["missing uppercase", "aa1!abcd"],
    ["missing lowercase", "AA1!ABCD"],
    ["missing number", "Aa!abcde"],
    ["missing special character", "Aa1abcde"],
  ])("login rejects password with %s", (_label, password) => {
    expect(() => authValidation.login.parse(getLoginInput(password))).toThrow();
  });

  test("register rejects password shorter than 8 characters", () => {
    expect(() => authValidation.register.parse(getRegisterInput("Aa1!abc"))).toThrow();
  });

  test("login rejects password shorter than 8 characters", () => {
    expect(() => authValidation.login.parse(getLoginInput("Aa1!abc"))).toThrow();
  });

  test("register rejects password over bcrypt UTF-8 byte limit", () => {
    const overByteLimitPassword = `Aa1!${"\u{1F600}".repeat(18)}`;
    expect(() =>
      authValidation.register.parse(getRegisterInput(overByteLimitPassword))
    ).toThrow(/72 bytes/i);
  });

  test("login rejects password over bcrypt UTF-8 byte limit", () => {
    const overByteLimitPassword = `Aa1!${"\u{1F600}".repeat(18)}`;
    expect(() => authValidation.login.parse(getLoginInput(overByteLimitPassword))).toThrow(
      /72 bytes/i
    );
  });
});


