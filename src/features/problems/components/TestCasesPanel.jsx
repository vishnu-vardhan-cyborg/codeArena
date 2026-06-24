import { useState } from "react";

export default function TestCasesPanel({
  testCases = []
}) {

  const [
    selected,
    setSelected
  ] = useState(0);

  const current =
    testCases[selected];

  return (

    <div>

      <div
        className="
          testcase-tabs
        "
      >

        {
          testCases.map(
            (_,index) => (

              <button
                key={index}
                className={
                  selected === index
                  ? "testcase-tab active"
                  : "testcase-tab"
                }
                onClick={() =>
                  setSelected(index)
                }
              >
                Case {index + 1}
              </button>

            )
          )
        }

      </div>

      {
        current &&
        (
          <div
            className="
              testcase-card
            "
          >

            <div
              className="
                testcase-section
              "
            >
              <div
                className="
                  testcase-label
                "
              >
                Input
              </div>

              {
                current.args?.map(
                  (
                    arg,
                    index
                  ) => (

                    <div
                      key={index}
                      className="
                        testcase-value
                      "
                    >
                      {
                        current
                          .arg_types?.[
                            index
                          ]
                      }
                      {" = "}
                      {
                        JSON.stringify(
                          arg
                        )
                      }
                    </div>

                  )
                )
              }

            </div>

            <div
              className="
                testcase-section
              "
            >
              <div
                className="
                  testcase-label
                "
              >
                Expected Output
              </div>

              <div
                className="
                  testcase-value
                "
              >
                {
                  JSON.stringify(
                    current.expected_output
                  )
                }
              </div>

            </div>

          </div>
        )
      }

    </div>

  );
}