import Link from 'next/link';

export default function AnimatedButton({ href, text, primary = false, icon, className = '', ...props }) {
  const baseClasses = 'group relative inline-flex items-center justify-center overflow-hidden rounded-full font-medium transition-all duration-300 focus:outline-none';
  const primaryClasses = 'bg-blue-600 text-white hover:bg-blue-500 px-8 py-3 shadow-[0_0_20px_rgba(0,117,223,0.3)] hover:shadow-[0_0_30px_rgba(0,117,223,0.5)]';
  const secondaryClasses = 'bg-transparent text-white border border-slate-700 hover:border-slate-500 px-8 py-3 hover:bg-slate-800/50';

  const classes = `${baseClasses} ${primary ? primaryClasses : secondaryClasses} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        <span className="relative flex items-center z-10">
          {text}
          {icon}
        </span>
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      <span className="relative flex items-center z-10">
        {text}
        {icon}
      </span>
    </button>
  );
}
