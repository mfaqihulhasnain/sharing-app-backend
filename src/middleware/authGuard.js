// Purpose: protect private routes once the final auth strategy is confirmed.
const authGuard = (_req, _res, next) => {
  // TODO: implement JWT or session verification after the auth strategy is confirmed.
  next();
};

module.exports = authGuard;
