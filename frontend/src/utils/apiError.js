export const getApiErrorMessage = (error, fallbackMessage = 'Something went wrong. Please try again.', options = {}) => {
  const responseData = error?.response?.data;

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData.trim();
  }

  if (typeof responseData?.error === 'string' && responseData.error.trim()) {
    return responseData.error.trim();
  }

  if (typeof responseData?.message === 'string' && responseData.message.trim()) {
    return responseData.message.trim();
  }

  if (error?.response?.status === 401 && options.unauthorizedMessage) {
    return options.unauthorizedMessage;
  }

  if (
    typeof error?.message === 'string' &&
    error.message.trim() &&
    !/^request failed with status code \d+$/i.test(error.message.trim())
  ) {
    return error.message.trim();
  }

  return fallbackMessage;
};
