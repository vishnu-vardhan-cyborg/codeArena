export default function ProblemDescription({
  problem
}) {

  return (

<div className="problem-description">

      <h1 className="text-2xl font-bold">
        {problem.title}
      </h1>

      <div className="flex gap-2 mt-2">

        <span>
          {problem.difficulty}
        </span>

        <span>
          ⭐ {problem.xp_reward}
        </span>

      </div>

      <div className="mt-4">

        {problem.topics?.map(
          topic => (
            <span
              key={topic}
              className="
                bg-zinc-800
                px-2
                py-1
                rounded
                mr-2
              "
            >
              {topic}
            </span>
          )
        )}

      </div>

      <p className="mt-5">
        {problem.description}
      </p>

      <h3 className="mt-6 font-bold">
        Constraints
      </h3>

      <ul>

        {
          problem.constraints?.map(
            c => (
              <li key={c}>
                {c}
              </li>
            )
          )
        }

      </ul>

      <h3 className="mt-6 font-bold">
        Examples
      </h3>

      {
        problem.examples?.map(
          (e,index)=>(
            <div
              key={index}
              className="
                bg-zinc-900
                p-4
                rounded
                mt-3
              "
            >
              <pre>
                Input:
                {"\n"}
                {e.input}
              </pre>

              <pre>
                Output:
                {"\n"}
                {e.output}
              </pre>

              {
                e.explanation &&
                (
                  <pre>
                    Explanation:
                    {"\n"}
                    {e.explanation}
                  </pre>
                )
              }

            </div>
          )
        )
      }

    </div>
  );
}