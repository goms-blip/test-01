'use client';

export default function EmptyState({ emoji = '🥕', title, desc, action, secondary }) {
  return (
    <div className="card mt-3 px-6 py-12 text-center">
      <div className="text-5xl mb-3">{emoji}</div>
      <div className="font-bold text-lg">{title}</div>
      {desc && <div className="text-sm text-gray-500 mt-1.5 leading-relaxed">{desc}</div>}
      <div className="flex justify-center gap-2 mt-5">
        {action && (
          <button onClick={action.onClick} className="btn-carrot rounded-xl px-5 py-2.5 text-sm font-semibold">{action.label}</button>
        )}
        {secondary && (
          <button onClick={secondary.onClick} className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-[color:var(--line)] text-gray-700">{secondary.label}</button>
        )}
      </div>
    </div>
  );
}
