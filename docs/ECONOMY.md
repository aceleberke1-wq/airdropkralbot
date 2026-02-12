# Economy

## Soft Currency Emission
SC_reward = Base_SC * (1 + a1*t) * (1 + a2*ln(1+s)) * (1 + a3*k) * (1 / (1 + a4*max(0, n - n0))) * (1 - a5*r)

## Hard Currency Probability
p_HC = clamp(p0 + b1*ln(1+s) + b2*m - b3*r, p_min, p_max)

## Pity
If misses >= PITY_CAP then force HC drop.

## Sinks
1. Boosts
2. Cooldown skips
3. Recovery
4. Event tickets