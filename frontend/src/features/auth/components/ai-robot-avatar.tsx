'use client';

import { Box } from '@mui/material';

export type RobotFocusMode = 'idle' | 'email' | 'password';

type AiRobotAvatarProps = {
    mode: RobotFocusMode;
    emailCursorPosition: number;
};

const MAX_VISIBLE_EMAIL_CHARACTERS = 28;

export function AiRobotAvatar({
    mode,
    emailCursorPosition,
}: AiRobotAvatarProps) {
    const isWatchingEmail = mode === 'email';
    const isHidingEyes = mode === 'password';

    const cursorProgress = Math.min(
        Math.max(emailCursorPosition, 0),
        MAX_VISIBLE_EMAIL_CHARACTERS,
    );

    const pupilOffsetX = isWatchingEmail
        ? -5 + (cursorProgress / MAX_VISIBLE_EMAIL_CHARACTERS) * 10
        : 0;

    const pupilOffsetY = isWatchingEmail ? 5 : 0;

    const eyeScaleY = isHidingEyes ? 0.12 : 1;

    return (
        <Box
            aria-hidden="true"
            sx={{
                display: 'flex',
                justifyContent: 'center',
                mb: 2,
            }}
        >
            <Box
                component="svg"
                viewBox="0 0 220 185"
                focusable="false"
                sx={{
                    display: 'block',
                    width: {
                        xs: 132,
                        sm: 150,
                    },
                    height: 'auto',
                    overflow: 'visible',
                    filter: 'drop-shadow(0 12px 18px rgba(67, 67, 150, 0.18))',

                    '& .robot-eye': {
                        transition: 'transform 180ms ease',
                    },

                    '& .robot-pupil': {
                        transition: 'cx 180ms ease, cy 180ms ease',
                    },

                    '& .robot-hand': {
                        transition:
                            'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                    },

                    '@media (prefers-reduced-motion: reduce)': {
                        '& .robot-eye, & .robot-pupil, & .robot-hand': {
                            transition: 'none',
                        },
                    },
                }}
            >
                <defs>
                    <linearGradient
                        id="robot-head-gradient"
                        x1="48"
                        y1="32"
                        x2="174"
                        y2="143"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop stopColor="#7777EA" />
                        <stop offset="1" stopColor="#4C4CC5" />
                    </linearGradient>

                    <linearGradient
                        id="robot-body-gradient"
                        x1="76"
                        y1="132"
                        x2="146"
                        y2="178"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop stopColor="#6565DC" />
                        <stop offset="1" stopColor="#3F3FAF" />
                    </linearGradient>
                </defs>

                <path
                    d="M110 31V17"
                    stroke="#4C4CC5"
                    strokeWidth="7"
                    strokeLinecap="round"
                />

                <circle cx="110" cy="12" r="8" fill="#64D8C2" />

                <rect
                    x="72"
                    y="126"
                    width="76"
                    height="48"
                    rx="24"
                    fill="url(#robot-body-gradient)"
                />

                <rect
                    x="25"
                    y="68"
                    width="24"
                    height="45"
                    rx="12"
                    fill="#4545AF"
                />

                <rect
                    x="171"
                    y="68"
                    width="24"
                    height="45"
                    rx="12"
                    fill="#4545AF"
                />

                <rect
                    x="38"
                    y="29"
                    width="144"
                    height="119"
                    rx="42"
                    fill="url(#robot-head-gradient)"
                />

                <rect
                    x="52"
                    y="48"
                    width="116"
                    height="79"
                    rx="31"
                    fill="#F7F8FF"
                />

                <circle cx="79" cy="79" r="17" fill="#FFFFFF" />
                <circle cx="141" cy="79" r="17" fill="#FFFFFF" />

                <g
                    className="robot-eye"
                    style={{
                        transform: `scaleY(${eyeScaleY})`,
                        transformOrigin: '79px 79px',
                    }}
                >
                    <circle
                        className="robot-pupil"
                        cx={79 + pupilOffsetX}
                        cy={79 + pupilOffsetY}
                        r="7"
                        fill="#27275F"
                    />
                </g>

                <g
                    className="robot-eye"
                    style={{
                        transform: `scaleY(${eyeScaleY})`,
                        transformOrigin: '141px 79px',
                    }}
                >
                    <circle
                        className="robot-pupil"
                        cx={141 + pupilOffsetX}
                        cy={79 + pupilOffsetY}
                        r="7"
                        fill="#27275F"
                    />
                </g>

                <path
                    d="M91 105C96 111 103 114 110 114C117 114 124 111 129 105"
                    fill="none"
                    stroke="#4C4CC5"
                    strokeWidth="5"
                    strokeLinecap="round"
                />

                <g
                    className="robot-hand"
                    style={{
                        transform: isHidingEyes
                            ? 'translate(12px, -51px) rotate(-8deg)'
                            : 'translate(0, 0) rotate(0deg)',
                        transformBox: 'view-box',
                        transformOrigin: '66px 132px',
                    }}
                >
                    <path
                        d="M43 157C48 146 56 138 66 132"
                        fill="none"
                        stroke="#5959C9"
                        strokeWidth="15"
                        strokeLinecap="round"
                    />

                    <circle cx="68" cy="130" r="17" fill="#8A8AF0" />

                    <path
                        d="M58 121L54 114M66 117L64 109M74 119L76 111"
                        fill="none"
                        stroke="#8A8AF0"
                        strokeWidth="7"
                        strokeLinecap="round"
                    />
                </g>

                <g
                    className="robot-hand"
                    style={{
                        transform: isHidingEyes
                            ? 'translate(-12px, -51px) rotate(8deg)'
                            : 'translate(0, 0) rotate(0deg)',
                        transformBox: 'view-box',
                        transformOrigin: '154px 132px',
                    }}
                >
                    <path
                        d="M177 157C172 146 164 138 154 132"
                        fill="none"
                        stroke="#5959C9"
                        strokeWidth="15"
                        strokeLinecap="round"
                    />

                    <circle cx="152" cy="130" r="17" fill="#8A8AF0" />

                    <path
                        d="M162 121L166 114M154 117L156 109M146 119L144 111"
                        fill="none"
                        stroke="#8A8AF0"
                        strokeWidth="7"
                        strokeLinecap="round"
                    />
                </g>
            </Box>
        </Box>
    );
}
