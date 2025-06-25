export function Logo() {
    return (
        <div className="flex items-center">
            <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-indigo-600"
            >
                <path
                    d="M24 4L4 24L24 44M24 4L44 24L24 44M24 4L44 44M24 4L4 44"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <span className="ml-2 text-3xl font-bold">Shortcut</span>
        </div>
    )
}
