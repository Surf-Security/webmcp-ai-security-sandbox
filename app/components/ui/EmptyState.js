import clsx from 'clsx';

export default function EmptyState({ icon: Icon, title, body, actions, className }) {
  return (
    <div className={clsx('flex flex-col items-center gap-3 rounded-lg border border-line bg-card px-6 py-10 text-center', className)}>
      {Icon && (
        <div className="rounded-full bg-line p-3 text-mut">
          <Icon size={22} />
        </div>
      )}
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        {body && <div className="mx-auto mt-1 max-w-sm text-sm text-mut">{body}</div>}
      </div>
      {actions && actions.length > 0 && (
        <div className="mt-1 flex gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                action.variant === 'primary'
                  ? 'bg-surf text-white hover:opacity-90'
                  : 'border border-line text-ink hover:bg-bg',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
