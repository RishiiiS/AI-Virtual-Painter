import React from 'react';
import { Smile, Star, Zap, Cloud, Ghost } from 'lucide-react';

// Shared avatar key → Lucide icon mapping
const AVATAR_MAP = {
    smile: Smile,
    star: Star,
    zap: Zap,
    cloud: Cloud,
    ghost: Ghost,
};

export const AVATAR_KEYS = ['smile', 'star', 'zap', 'cloud', 'ghost'];

const AvatarIcon = ({ avatarKey = 'ghost', size = 28, strokeWidth = 2.5 }) => {
    const Icon = AVATAR_MAP[avatarKey] || Ghost;
    return <Icon size={size} strokeWidth={strokeWidth} />;
};

export default AvatarIcon;
