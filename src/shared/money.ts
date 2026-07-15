const MINOR_UNITS_PER_MAJOR = 100;

export const toMinorUnits = (major: number): number => {
  if (!Number.isFinite(major)) {
    throw new Error(
      `Cannot convert non-finite amount to minor units: ${major}`,
    );
  }
  return Math.round(major * MINOR_UNITS_PER_MAJOR);
};

export const toMajorUnitsString = (minor: number): string => {
  if (!Number.isInteger(minor)) {
    throw new Error(`Minor units must be an integer, got: ${minor}`);
  }
  return (minor / MINOR_UNITS_PER_MAJOR).toFixed(2);
};
