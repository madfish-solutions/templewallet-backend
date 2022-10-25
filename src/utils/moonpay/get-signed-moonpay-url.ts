import crypto from 'crypto';

export const getSignedMoonPayUrl = (originalUrl: string) => {
    const signature = crypto
        .createHmac('sha256', process.env.MOONPAY_SECRET_KEY!)
        .update(new URL(originalUrl).search)
        .digest('base64');

    return `${originalUrl}&signature=${encodeURIComponent(signature)}`;
};
