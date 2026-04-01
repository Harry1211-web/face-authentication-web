export function parseDescriptor(descriptorInput) {
  if (!Array.isArray(descriptorInput)) {
    throw new Error("faceDescriptor must be an array");
  }
  if (descriptorInput.length !== 128) {
    throw new Error("faceDescriptor must contain 128 values");
  }

  return descriptorInput.map((value) => Number(value));
}

export function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function compareFace(storedDescriptor, loginDescriptor, threshold = 0.5) {
  const distance = euclideanDistance(storedDescriptor, loginDescriptor);
  return {
    distance,
    match: distance <= threshold,
  };
}
